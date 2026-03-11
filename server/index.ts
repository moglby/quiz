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
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 3001;

app.use(cors());

// Типы
interface Player {
  id: string;
  name: string;
  score: number;
  isReady: boolean;
  isHost: boolean;
}

interface Room {
  id: string;
  players: Map<string, Player>;
  category: string | null;
  currentQuestionIndex: number;
  questions: any[];
  buzzedPlayers: string[];
  currentPlayerTurn: string | null;
  gameState: 'lobby' | 'playing' | 'finished';
}

const rooms = new Map<string, Room>();

// Генерация кода комнаты (6 цифр)
function generateRoomCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Получение уникального кода
function getUniqueRoomCode(): string {
  let code = generateRoomCode();
  while (rooms.has(code)) {
    code = generateRoomCode();
  }
  return code;
}

app.use(cors());
app.use(express.static(path.join(__dirname, '../dist')));

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // Создание комнаты
  socket.on('createRoom', (playerName: string) => {
    const roomCode = getUniqueRoomCode();
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
      buzzedPlayers: [],
      currentPlayerTurn: null,
      gameState: 'lobby',
    };

    rooms.set(roomCode, room);
    socket.join(roomCode);

    socket.emit('roomCreated', { roomCode, player });
    console.log(`Room created: ${roomCode} by ${player.name}`);
  });

  // Подключение к комнате
  socket.on('joinRoom', ({ roomCode, playerName }: { roomCode: string; playerName: string }) => {
    const room = rooms.get(roomCode);

    if (!room) {
      socket.emit('error', 'Комната не найдена');
      return;
    }

    if (room.players.size >= 4) {
      socket.emit('error', 'Комната полная');
      return;
    }

    if (room.gameState !== 'lobby') {
      socket.emit('error', 'Игра уже началась');
      return;
    }

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

  // Готовность игрока
  socket.on('toggleReady', () => {
    const room = findPlayerRoom(socket.id);
    if (!room) return;

    const player = room.players.get(socket.id);
    if (player) {
      player.isReady = !player.isReady;
      io.to(room.id).emit('playersUpdate', Array.from(room.players.values()));

      // Проверка готовности всех игроков
      const allReady = Array.from(room.players.values()).every((p) => p.isReady);
      if (allReady && room.players.size >= 2) {
        io.to(room.id).emit('allPlayersReady');
      }
    }
  });

  // Выбор категории
  socket.on('selectCategory', (category: string) => {
    const room = findPlayerRoom(socket.id);
    if (!room) return;

    const player = room.players.get(socket.id);
    if (!player?.isHost) return;

    room.category = category;
    io.to(room.id).emit('categorySelected', category);
  });

  // Начало игры
  socket.on('startGame', (data: { questions: any[]; count: number }) => {
    const room = findPlayerRoom(socket.id);
    if (!room) return;

    const player = room.players.get(socket.id);
    if (!player?.isHost) return;

    const questions = data.questions;
    const count = data.count;

    room.questions = questions;
    room.currentQuestionIndex = 0;
    room.gameState = 'playing';

    io.to(room.id).emit('gameStarted', {
      questions: room.questions,
      category: room.category,
      count: count,
    });

    sendQuestion(room);
  });

  // Игрок нажал на кнопку (buzz-in)
  socket.on('buzz', () => {
    const room = findPlayerRoom(socket.id);
    if (!room || room.gameState !== 'playing') return;

    const player = room.players.get(socket.id);
    if (!player) return;

    // Если ещё никто не нажал, или этот игрок ещё не нажимал
    if (room.buzzedPlayers.length === 0 || !room.buzzedPlayers.includes(socket.id)) {
      room.buzzedPlayers.push(socket.id);
      
      // Если это первый игрок, даём ему время на ответ
      if (room.buzzedPlayers.length === 1) {
        io.to(room.id).emit('playerBuzzed', { playerId: socket.id, playerName: player.name });
        room.currentPlayerTurn = socket.id;
        
        // Таймер на ответ 10 секунд
        setTimeout(() => {
          const currentRoom = rooms.get(room.id);
          if (currentRoom && currentRoom.currentPlayerTurn === socket.id) {
            io.to(room.id).emit('timeUpForAnswer');
            currentRoom.currentPlayerTurn = null;
            currentRoom.buzzedPlayers = [];
          }
        }, 10000);
      } else {
        io.to(room.id).emit('playerBuzzed', { playerId: socket.id, playerName: player.name });
      }
    }
  });

  // Ответ на вопрос
  socket.on('submitAnswer', (answerIndex: number) => {
    const room = findPlayerRoom(socket.id);
    if (!room) return;

    const player = room.players.get(socket.id);
    if (!player) return;

    const currentQuestion = room.questions[room.currentQuestionIndex];
    const isCorrect = answerIndex === currentQuestion.correctAnswer;

    if (isCorrect) {
      player.score += 10;
      // Отправляем результат СРАЗУ всем игрокам
      io.to(room.id).emit('answerCorrect', { playerId: socket.id, playerName: player.name });
    } else {
      // Отправляем результат СРАЗУ всем игрокам
      io.to(room.id).emit('answerWrong', { playerId: socket.id, playerName: player.name, correctAnswer: currentQuestion.correctAnswer });
    }

    io.to(room.id).emit('playersUpdate', Array.from(room.players.values()));

    // Проверяем это ли последний вопрос
    const isLastQuestion = room.currentQuestionIndex >= room.questions.length - 1;
    
    if (isLastQuestion) {
      // Это последний вопрос - переходим к итогам через 4 секунды
      setTimeout(() => {
        endGame(room);
      }, 4000);
    } else {
      // Не последний вопрос - переходим к следующему
      setTimeout(() => {
        nextQuestion(room);
      }, 4000);
    }
  });

  // Переход к следующему вопросу
  socket.on('nextQuestion', () => {
    const room = findPlayerRoom(socket.id);
    if (!room) return;
    
    nextQuestion(room);
  });

  // Пропуск ответа (если время вышло)
  socket.on('skipAnswer', () => {
    const room = findPlayerRoom(socket.id);
    if (!room) return;

    room.currentPlayerTurn = null;
    room.buzzedPlayers = [];
    io.to(room.id).emit('answerSkipped');

    // Автоматический переход к следующему вопросу через 4 секунды
    setTimeout(() => {
      nextQuestion(room);
    }, 4000);
  });

  // Конец игры
  socket.on('gameOver', () => {
    const room = findPlayerRoom(socket.id);
    if (!room) return;
    
    endGame(room);
  });

  // Выход из комнаты
  socket.on('leaveRoom', () => {
    const room = findPlayerRoom(socket.id);
    if (room) {
      room.players.delete(socket.id);
      io.to(room.id).emit('playersUpdate', Array.from(room.players.values()));

      if (room.players.size === 0) {
        rooms.delete(room.id);
      } else if (room.players.size > 0) {
        // Назначаем нового хоста
        const newHost = room.players.values().next().value;
        if (newHost) {
          newHost.isHost = true;
          io.to(room.id).emit('newHost', newHost.id);
        }
      }
    }
    socket.leave(room?.id || '');
  });

  // Отключение
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    const room = findPlayerRoom(socket.id);
    if (room) {
      room.players.delete(socket.id);
      io.to(room.id).emit('playersUpdate', Array.from(room.players.values()));

      if (room.players.size === 0) {
        rooms.delete(room.id);
      }
    }
  });
});

// Поиск комнаты игрока
function findPlayerRoom(playerId: string): Room | undefined {
  for (const room of rooms.values()) {
    if (room.players.has(playerId)) {
      return room;
    }
  }
  return undefined;
}

// Отправка вопроса
function sendQuestion(room: Room) {
  if (room.currentQuestionIndex >= room.questions.length) {
    endGame(room);
    return;
  }

  room.buzzedPlayers = [];
  room.currentPlayerTurn = null;

  io.to(room.id).emit('newQuestion', {
    question: room.questions[room.currentQuestionIndex],
    questionNumber: room.currentQuestionIndex + 1,
    totalQuestions: room.questions.length,
  });
}

// Переход к следующему вопросу
function nextQuestion(room: Room) {
  room.currentQuestionIndex++;
  
  // Проверяем, есть ли ещё вопросы
  if (room.currentQuestionIndex >= room.questions.length) {
    endGame(room);
  } else {
    sendQuestion(room);
  }
}

// Конец игры
function endGame(room: Room) {
  room.gameState = 'finished';
  const players = Array.from(room.players.values()).sort((a, b) => b.score - a.score);
  // Отправляем итоги СРАЗУ
  io.to(room.id).emit('gameOver', { results: players });
  console.log(`Game ended in room ${room.id}`);
}

// Обработка всех остальных запросов
app.get('/*path', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});
