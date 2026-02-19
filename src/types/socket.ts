export interface Player {
  id: string;
  name: string;
  score: number;
  isReady: boolean;
  isHost: boolean;
}

export interface Question {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
  category: 'programming' | 'games' | 'math' | 'movies' | 'facts' | 'general';
}

export type GameState = 'menu' | 'solo' | 'lobby' | 'playing' | 'finished';

export type MultiplayerState = 'menu' | 'create' | 'join' | 'lobby' | 'playing' | 'finished';

export interface ServerToClientEvents {
  roomCreated: (data: { roomCode: string; player: Player }) => void;
  roomJoined: (data: { roomCode: string; player: Player }) => void;
  playersUpdate: (players: Player[]) => void;
  allPlayersReady: () => void;
  categorySelected: (category: string) => void;
  gameStarted: (data: { questions: Question[]; category: string | null }) => void;
  newQuestion: (data: { question: Question; questionNumber: number; totalQuestions: number }) => void;
  playerBuzzed: (data: { playerId: string; playerName: string }) => void;
  answerCorrect: (data: { playerId: string; playerName: string }) => void;
  answerWrong: (data: { playerId: string; playerName: string; correctAnswer: number }) => void;
  answerSkipped: () => void;
  timeUpForAnswer: () => void;
  gameOver: (data: { results: Player[] }) => void;
  newHost: (playerId: string) => void;
  error: (message: string) => void;
}

export interface ClientToServerEvents {
  createRoom: (playerName: string) => void;
  joinRoom: (data: { roomCode: string; playerName: string }) => void;
  toggleReady: () => void;
  selectCategory: (category: string) => void;
  startGame: (questions: Question[]) => void;
  buzz: () => void;
  submitAnswer: (answerIndex: number) => void;
  skipAnswer: () => void;
  leaveRoom: () => void;
}
