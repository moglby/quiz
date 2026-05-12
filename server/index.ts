import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.static(path.join(__dirname, '../dist')));

interface Player {
  id: string;
  name: string;
  score: number;
  isReady: boolean;
  isHost: boolean;
}

interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
  category: string;
}

interface Room {
  id: string;
  players: Map<string, Player>;
  category: string | null;
  currentQuestionIndex: number;
  questions: QuizQuestion[];
  currentPlayerTurn: string | null;
  questionResolved: boolean;
  gameState: 'lobby' | 'playing' | 'finished';
  buzzTimer: ReturnType<typeof setTimeout> | null;
  nextTimer: ReturnType<typeof setTimeout> | null;
}

const rooms = new Map<string, Room>();

const ANSWER_TIME_MS = 10_000;
const NEXT_DELAY_MS = 5_000;

function generateRoomCode(): string {
  let code: string;
  do {
    code = Math.floor(100000 + Math.random() * 900000).toString();
  } while (rooms.has(code));
  return code;
}

function findPlayerRoom(playerId: string): Room | undefined {
  for (const room of rooms.values()) {
    if (room.players.has(playerId)) return room;
  }
  return undefined;
}

function clearBuzzTimer(room: Room) {
  if (room.buzzTimer) {
    clearTimeout(room.buzzTimer);
    room.buzzTimer = null;
  }
}

function clearNextTimer(room: Room) {
  if (room.nextTimer) {
    clearTimeout(room.nextTimer);
    room.nextTimer = null;
  }
}

function sendQuestion(room: Room) {
  if (room.currentQuestionIndex >= room.questions.length) {
    endGame(room);
    return;
  }
  clearBuzzTimer(room);
  clearNextTimer(room);
  room.currentPlayerTurn = null;
  room.questionResolved = false;

  io.to(room.id).emit('newQuestion', {
    question: room.questions[room.currentQuestionIndex],
    questionNumber: room.currentQuestionIndex + 1,
    totalQuestions: room.questions.length,
  });
}

function nextQuestion(room: Room) {
  if (room.gameState !== 'playing') return;
  room.currentQuestionIndex++;
  if (room.currentQuestionIndex >= room.questions.length) {
    endGame(room);
  } else {
    sendQuestion(room);
  }
}

function scheduleNext(room: Room) {
  clearNextTimer(room);
  const isLast = room.currentQuestionIndex >= room.questions.length - 1;
  room.nextTimer = setTimeout(() => {
    room.nextTimer = null;
    if (isLast) endGame(room);
    else nextQuestion(room);
  }, NEXT_DELAY_MS);
}

function endGame(room: Room) {
  clearBuzzTimer(room);
  clearNextTimer(room);
  room.gameState = 'finished';
  const players = Array.from(room.players.values()).sort((a, b) => b.score - a.score);
  io.to(room.id).emit('gameOver', { results: players });
  console.log(`Game ended in room ${room.id}`);
}

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  socket.on('createRoom', (playerName: string) => {
    const roomCode = generateRoomCode();
    const player: Player = {
      id: socket.id,
      name: playerName || `Игрок ${Math.floor(Math.random() * 1000)}`,
      score: 0,
      isReady: false,
      isHost: true,
    };

    const room: Room = {
      id: roomCode,
      players: new Map([[socket.id, player]]),
      category: null,
      currentQuestionIndex: 0,
      questions: [],
      currentPlayerTurn: null,
      questionResolved: false,
      gameState: 'lobby',
      buzzTimer: null,
      nextTimer: null,
    };

    rooms.set(roomCode, room);
    socket.join(roomCode);
    socket.emit('roomCreated', { roomCode, player });
    console.log(`Room created: ${roomCode} by ${player.name}`);
  });

  socket.on('joinRoom', ({ roomCode, playerName }: { roomCode: string; playerName: string }) => {
    const room = rooms.get(roomCode);
    if (!room) return socket.emit('error', 'Комната не найдена');
    if (room.players.size >= 4) return socket.emit('error', 'Комната полная');
    if (room.gameState !== 'lobby') return socket.emit('error', 'Игра уже началась');

    const player: Player = {
      id: socket.id,
      name: playerName || `Игрок ${Math.floor(Math.random() * 1000)}`,
      score: 0,
      isReady: false,
      isHost: false,
    };

    room.players.set(socket.id, player);
    socket.join(roomCode);
    socket.emit('roomJoined', { roomCode, player });
    io.to(roomCode).emit('playersUpdate', Array.from(room.players.values()));
    console.log(`${player.name} joined room ${roomCode}`);
  });

  socket.on('toggleReady', () => {
    const room = findPlayerRoom(socket.id);
    if (!room) return;
    const player = room.players.get(socket.id);
    if (!player) return;
    player.isReady = !player.isReady;
    io.to(room.id).emit('playersUpdate', Array.from(room.players.values()));

    const allReady = Array.from(room.players.values()).every((p) => p.isReady);
    if (allReady && room.players.size >= 2) {
      io.to(room.id).emit('allPlayersReady');
    }
  });

  socket.on('selectCategory', (category: string) => {
    const room = findPlayerRoom(socket.id);
    if (!room) return;
    const player = room.players.get(socket.id);
    if (!player?.isHost) return;
    room.category = category;
    io.to(room.id).emit('categorySelected', category);
  });

  socket.on('startGame', (data: { questions: QuizQuestion[]; count: number }) => {
    const room = findPlayerRoom(socket.id);
    if (!room) return;
    const player = room.players.get(socket.id);
    if (!player?.isHost) return;

    clearBuzzTimer(room);
    clearNextTimer(room);

    room.questions = data.questions;
    room.currentQuestionIndex = 0;
    room.gameState = 'playing';
    room.questionResolved = false;
    room.currentPlayerTurn = null;
    room.players.forEach((p) => { p.score = 0; });
    io.to(room.id).emit('playersUpdate', Array.from(room.players.values()));

    io.to(room.id).emit('gameStarted', {
      questions: room.questions,
      category: room.category,
      count: data.count,
    });

    sendQuestion(room);
  });

  socket.on('buzz', () => {
    const room = findPlayerRoom(socket.id);
    if (!room || room.gameState !== 'playing') return;
    if (room.questionResolved || room.currentPlayerTurn) return;

    const player = room.players.get(socket.id);
    if (!player) return;

    room.currentPlayerTurn = socket.id;
    io.to(room.id).emit('playerBuzzed', { playerId: socket.id, playerName: player.name });

    // Снимок индекса вопроса — если за время ожидания мы ушли дальше,
    // старый таймер ничего не должен делать.
    const questionIndexAtBuzz = room.currentQuestionIndex;
    const buzzedPlayerId = socket.id;

    clearBuzzTimer(room);
    room.buzzTimer = setTimeout(() => {
      room.buzzTimer = null;
      if (
        room.gameState !== 'playing' ||
        room.questionResolved ||
        room.currentQuestionIndex !== questionIndexAtBuzz ||
        room.currentPlayerTurn !== buzzedPlayerId
      ) return;

      io.to(room.id).emit('timeUpForAnswer');
      room.questionResolved = true;
      room.currentPlayerTurn = null;
      scheduleNext(room);
    }, ANSWER_TIME_MS);
  });

  socket.on('submitAnswer', (answerIndex: number) => {
    const room = findPlayerRoom(socket.id);
    if (!room || room.gameState !== 'playing') return;
    if (room.currentPlayerTurn !== socket.id || room.questionResolved) return;

    const player = room.players.get(socket.id);
    const currentQuestion = room.questions[room.currentQuestionIndex];
    if (!player || !currentQuestion) return;

    clearBuzzTimer(room);
    room.questionResolved = true;
    room.currentPlayerTurn = null;

    const isCorrect = answerIndex === currentQuestion.correctAnswer;
    if (isCorrect) player.score += 10;

    io.to(room.id).emit(isCorrect ? 'answerCorrect' : 'answerWrong', {
      playerId: socket.id,
      playerName: player.name,
      correctAnswer: currentQuestion.correctAnswer,
    });
    io.to(room.id).emit('playersUpdate', Array.from(room.players.values()));

    scheduleNext(room);
  });

  socket.on('skipAnswer', () => {
    const room = findPlayerRoom(socket.id);
    if (!room || room.gameState !== 'playing') return;
    if (room.currentPlayerTurn !== socket.id || room.questionResolved) return;

    const player = room.players.get(socket.id);
    const currentQuestion = room.questions[room.currentQuestionIndex];
    if (!player || !currentQuestion) return;

    clearBuzzTimer(room);
    room.questionResolved = true;
    room.currentPlayerTurn = null;

    io.to(room.id).emit('answerSkipped', {
      playerId: socket.id,
      playerName: player.name,
      correctAnswer: currentQuestion.correctAnswer,
    });

    scheduleNext(room);
  });

  socket.on('leaveRoom', () => {
    const room = findPlayerRoom(socket.id);
    if (!room) return;
    handleLeave(room, socket.id);
    socket.leave(room.id);
  });

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    const room = findPlayerRoom(socket.id);
    if (room) handleLeave(room, socket.id);
  });
});

function handleLeave(room: Room, playerId: string) {
  room.players.delete(playerId);

  if (room.players.size === 0) {
    clearBuzzTimer(room);
    clearNextTimer(room);
    rooms.delete(room.id);
    return;
  }

  io.to(room.id).emit('playersUpdate', Array.from(room.players.values()));

  const stillHasHost = Array.from(room.players.values()).some((p) => p.isHost);
  if (!stillHasHost) {
    const newHost = room.players.values().next().value;
    if (newHost) {
      newHost.isHost = true;
      io.to(room.id).emit('newHost', newHost.id);
      io.to(room.id).emit('playersUpdate', Array.from(room.players.values()));
    }
  }

  // Если ушёл тот, чья очередь была отвечать — переходим дальше
  if (room.gameState === 'playing' && room.currentPlayerTurn === playerId) {
    clearBuzzTimer(room);
    room.currentPlayerTurn = null;
    if (!room.questionResolved) {
      room.questionResolved = true;
      const q = room.questions[room.currentQuestionIndex];
      if (q) {
        io.to(room.id).emit('answerSkipped', {
          playerId,
          playerName: 'Игрок',
          correctAnswer: q.correctAnswer,
        });
      }
      scheduleNext(room);
    }
  }
}

app.get('/*path', (_req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});
