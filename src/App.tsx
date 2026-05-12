import { useState, useEffect, useRef } from 'react';
import './App.css';
import {
  questions,
  type Category,
  type Question,
  categoryNames,
  categoryIcons,
} from './data/questions';
import { useSocket } from './hooks/useSocket';
import type { Player } from './types/socket';

type GameState = 'menu' | 'category' | 'solo' | 'lobby' | 'playing' | 'buzz' | 'finished';
type MultiplayerMode = 'none' | 'menu' | 'create' | 'join';

const QUESTION_OPTIONS = [10, 20, 30];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function App() {
  const { socket, isConnected } = useSocket();

  // Состояния игры
  const [gameState, setGameState] = useState<GameState>('menu');
  const [multiplayerMode, setMultiplayerMode] = useState<MultiplayerMode>('none');
  
  // Состояния для соло
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [pendingSoloCategory, setPendingSoloCategory] = useState<Category | null>(null);
  const [soloQuestionsCount, setSoloQuestionsCount] = useState(10);
  const [currentQuestions, setCurrentQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);

  // Состояния для мультиплеера
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [selectedCategoryMp, setSelectedCategoryMp] = useState<Category | null>(null);
  const [mpQuestionsCount, setMpQuestionsCount] = useState(20); // Количество вопросов для мультиплеера
  const [_mpQuestions, setMpQuestions] = useState<Question[]>([]);
  const [mpQuestionIndex, setMpQuestionIndex] = useState(0);
  const [canBuzz, setCanBuzz] = useState(false);
  const [hasBuzzed, setHasBuzzed] = useState(false);
  const [buzzedPlayer, setBuzzedPlayer] = useState<Player | null>(null);
  const [answerTimeLeft, setAnswerTimeLeft] = useState(10);
  const [currentMpQuestion, setCurrentMpQuestion] = useState<Question | null>(null);
  const [gameResults, setGameResults] = useState<Player[]>([]);
  const [error, setError] = useState('');
  const [answerResult, setAnswerResult] = useState<{correct: boolean; correctAnswer?: number; answeringPlayer?: Player; question?: Question} | null>(null);
  const [isBuzzingBlocked, setIsBuzzingBlocked] = useState(false);
  const [autoNextTimer, setAutoNextTimer] = useState(5);
  const [isAnswerLocked, setIsAnswerLocked] = useState(false);

  const playersRef = useRef<Player[]>([]);
  const currentMpQuestionRef = useRef<Question | null>(null);
  const buzzUnlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentQuestion = currentQuestions[currentQuestionIndex];

  const startBuzzUnlockTimer = () => {
    if (buzzUnlockTimerRef.current) {
      clearTimeout(buzzUnlockTimerRef.current);
    }
    setIsBuzzingBlocked(true);
    setCanBuzz(false);
    buzzUnlockTimerRef.current = setTimeout(() => {
      setIsBuzzingBlocked(false);
      setCanBuzz(true);
    }, 1500);
  };

  useEffect(() => {
    return () => {
      if (buzzUnlockTimerRef.current) {
        clearTimeout(buzzUnlockTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  useEffect(() => {
    currentMpQuestionRef.current = currentMpQuestion;
  }, [currentMpQuestion]);

  // Соло игра - таймер
  useEffect(() => {
    if (gameState === 'solo' && !showResult && timeLeft > 0) {
      const timer = setTimeout(() => {
        if (timeLeft <= 1) {
          setTimeLeft(0);
          setShowResult(true);
          setSelectedAnswer(-1);
        } else {
          setTimeLeft(timeLeft - 1);
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft, gameState, showResult]);

  // Мультиплеер - таймер на ответ (только визуальный отсчёт, сервер сам пропустит по таймауту)
  useEffect(() => {
    if (gameState !== 'buzz' || buzzedPlayer?.id !== socket?.id) return;
    if (answerTimeLeft <= 0) return;
    const timer = setTimeout(() => setAnswerTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [answerTimeLeft, gameState, buzzedPlayer, socket]);

  // Подписка на события сокета
  useEffect(() => {
    if (!socket) return;

    socket.on('roomCreated', ({ roomCode, player }) => {
      setRoomCode(roomCode);
      setIsHost(player.isHost);
      setPlayers([player]);
      setGameState('lobby');
      setMultiplayerMode('create');
    });

    socket.on('roomJoined', ({ roomCode, player }) => {
      setRoomCode(roomCode);
      setIsHost(player.isHost);
      setPlayers([player]);
      setGameState('lobby');
      setMultiplayerMode('join');
    });

    socket.on('playersUpdate', (updatedPlayers) => {
      setPlayers(updatedPlayers);
      const me = updatedPlayers.find((p) => p.id === socket.id);
      setIsReady(Boolean(me?.isReady));
    });

    socket.on('allPlayersReady', () => {
      // Все готовы, можно начинать
    });

    socket.on('categorySelected', (category) => {
      setSelectedCategoryMp(category as Category);
    });

    socket.on('gameStarted', ({ questions, category, count }) => {
      setMpQuestions(questions as unknown as Question[]);
      setMpQuestionIndex(0);
      setSelectedCategoryMp(category as Category);
      if (count) setMpQuestionsCount(count);
      // Сбрасываем состояние предыдущей игры
      setCurrentMpQuestion(null);
      setBuzzedPlayer(null);
      setAnswerResult(null);
      setIsAnswerLocked(false);
      setHasBuzzed(false);
      setCanBuzz(false);
      setIsBuzzingBlocked(false);
      setGameState('playing');
      setMultiplayerMode('none');
    });

    socket.on('newQuestion', ({ question, questionNumber }) => {
      setCurrentMpQuestion(question as unknown as Question);
      setMpQuestionIndex(questionNumber - 1);
      setHasBuzzed(false);
      setBuzzedPlayer(null);
      setAnswerResult(null);
      setIsAnswerLocked(false);
      setAnswerTimeLeft(10);
      setAutoNextTimer(5);
      startBuzzUnlockTimer();
      setGameState('playing');
    });

    socket.on('playerBuzzed', ({ playerId, playerName }) => {
      setCanBuzz(false);
      setAnswerResult(null);
      const player = playersRef.current.find((p) => p.id === playerId);
      const buzzed = player || { id: playerId, name: playerName, score: 0, isReady: false, isHost: false };
      setBuzzedPlayer(buzzed);
      setIsAnswerLocked(false);
      setGameState('buzz');
      setAnswerTimeLeft(10);
    });

    const handleAnswerOutcome = (correct: boolean) =>
      ({ playerId, correctAnswer }: { playerId: string; correctAnswer: number }) => {
        const answeringPlayer = playersRef.current.find((p) => p.id === playerId);
        setAnswerResult({
          correct,
          correctAnswer,
          answeringPlayer: answeringPlayer || undefined,
          question: currentMpQuestionRef.current || undefined,
        });
        setIsAnswerLocked(false);
        setAutoNextTimer(5);
      };

    socket.on('answerCorrect', handleAnswerOutcome(true));
    socket.on('answerWrong', handleAnswerOutcome(false));
    socket.on('answerSkipped', handleAnswerOutcome(false));

    socket.on('timeUpForAnswer', () => {
      setBuzzedPlayer(null);
      setIsAnswerLocked(false);
      setHasBuzzed(false);
      setGameState('playing');
    });

    socket.on('gameOver', ({ results }) => {
      setGameResults(results);
      setGameState('finished');
      setBuzzedPlayer(null);
      setAnswerResult(null);
      setCurrentMpQuestion(null);
      setIsAnswerLocked(false);
      if (buzzUnlockTimerRef.current) {
        clearTimeout(buzzUnlockTimerRef.current);
      }
    });

    socket.on('newHost', (playerId) => {
      if (playerId === socket.id) {
        setIsHost(true);
      }
    });

    socket.on('error', (message) => {
      setError(message);
      setTimeout(() => setError(''), 3000);
    });

    return () => {
      socket.off('roomCreated');
      socket.off('roomJoined');
      socket.off('playersUpdate');
      socket.off('allPlayersReady');
      socket.off('categorySelected');
      socket.off('gameStarted');
      socket.off('newQuestion');
      socket.off('playerBuzzed');
      socket.off('answerCorrect');
      socket.off('answerWrong');
      socket.off('answerSkipped');
      socket.off('timeUpForAnswer');
      socket.off('gameOver');
      socket.off('newHost');
      socket.off('error');
      socket.off('newHost');
      socket.off('error');
    };
  }, [socket]);

  // Обработчики для соло игры
  const handleStartSolo = () => {
    setGameState('category');
  };

  const handleCategorySelectSolo = (category: Category, count: number) => {
    setSelectedCategory(category);
    const selectedQuestions = shuffle(questions.filter((q) => q.category === category))
      .slice(0, count);

    setCurrentQuestions(selectedQuestions);
    setCurrentQuestionIndex(0);
    setScore(0);
    setGameState('solo');
    setTimeLeft(30);
    setSelectedAnswer(null);
    setShowResult(false);
    setPendingSoloCategory(null);
  };

  const handleAnswerSelect = (answerIndex: number) => {
    if (showResult) return;
    
    setSelectedAnswer(answerIndex);
    setShowResult(true);

    if (answerIndex === currentQuestion.correctAnswer) {
      setScore(score + 1);
    }
  };

  const handleNextQuestionSolo = () => {
    if (currentQuestionIndex < currentQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setTimeLeft(30);
      setSelectedAnswer(null);
      setShowResult(false);
    } else {
      setGameState('finished');
    }
  };

  const handleRestartSolo = () => {
    setGameState('menu');
    setSelectedCategory(null);
    setCurrentQuestions([]);
    setCurrentQuestionIndex(0);
    setScore(0);
    setTimeLeft(30);
    setSelectedAnswer(null);
    setShowResult(false);
  };

  // Обработчики для мультиплеера
  const handleCreateRoom = () => {
    if (!playerName.trim()) {
      setError('Введите имя');
      return;
    }
    if (!socket) {
      setError('Ошибка подключения к серверу');
      return;
    }
    if (!isConnected) {
      setError('Нет подключения к серверу. Проверьте, запущен ли сервер.');
      return;
    }
    socket.emit('createRoom', playerName.trim());
  };

  const handleJoinRoom = () => {
    if (!playerName.trim()) {
      setError('Введите имя');
      return;
    }
    if (!joinCode.trim()) {
      setError('Введите код комнаты');
      return;
    }
    socket?.emit('joinRoom', { roomCode: joinCode.trim(), playerName: playerName.trim() });
  };

  const handleToggleReady = () => {
    socket?.emit('toggleReady');
  };

  const handleSelectCategory = (category: Category) => {
    setSelectedCategoryMp(category);
    socket?.emit('selectCategory', category);
  };

  const handleStartMultiplayer = () => {
    if (!selectedCategoryMp) {
      setError('Выберите категорию');
      return;
    }
    
    // Проверяем, что все игроки готовы
    const allReady = players.every((p) => p.isReady);
    if (!allReady) {
      setError('Не все игроки готовы!');
      return;
    }

    const categoryQuestions = shuffle(
      questions.filter((q) => q.category === selectedCategoryMp)
    ).slice(0, mpQuestionsCount);

    socket?.emit('startGame', { questions: categoryQuestions, count: mpQuestionsCount });
  };

  const handleBuzz = () => {
    if (!canBuzz || hasBuzzed) return;
    setHasBuzzed(true);
    socket?.emit('buzz');
  };

  const handleSubmitAnswer = (answerIndex: number) => {
    if (isAnswerLocked) return;
    setIsAnswerLocked(true);
    socket?.emit('submitAnswer', answerIndex);
  };

  const handleSkipAnswer = () => {
    if (isAnswerLocked) return;
    setIsAnswerLocked(true);
    socket?.emit('skipAnswer');
  };

  // Таймер автоматического перехода к следующему вопросу
  useEffect(() => {
    if (answerResult && autoNextTimer > 0) {
      const timer = setTimeout(() => setAutoNextTimer(autoNextTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [answerResult, autoNextTimer]);

  const handleLeaveRoom = () => {
    socket?.emit('leaveRoom');
    setGameState('menu');
    setMultiplayerMode('none');
    setPlayers([]);
    setIsReady(false);
    setIsHost(false);
    setRoomCode('');
    setSelectedCategoryMp(null);
  };

  const handleBackToMenu = () => {
    setGameState('menu');
    setMultiplayerMode('none');
    handleLeaveRoom();
  };

  const getButtonClass = (index: number) => {
    if (!showResult) return 'answer-btn';
    if (index === currentQuestion.correctAnswer) return 'answer-btn correct';
    if (index === selectedAnswer && index !== currentQuestion.correctAnswer) {
      return 'answer-btn wrong';
    }
    return 'answer-btn';
  };

  const formatTime = (seconds: number) => {
    return seconds.toString().padStart(2, '0');
  };

  // Рендер лобби - ПРОВЕРЯЕМ ПЕРЕД multiplayerMode
  if (gameState === 'lobby') {
    return (
      <div className="app">
        <div className="game-container">
          <div className="lobby-screen">
            <div className="lobby-header">
              <h2>🏠 Лобби</h2>
              <div className="room-code">
                Код комнаты: <strong>{roomCode}</strong>
              </div>
            </div>

            <div className="players-list">
              <h3>Игроки ({players.length}/4)</h3>
              {players.map((player) => (
                <div key={player.id} className={`player-item ${player.isHost ? 'host' : ''}`}>
                  <span className="player-name">
                    {player.isHost && '👑 '}
                    {player.name}
                    {player.id === socket?.id && ' (Вы)'}
                  </span>
                  <span className={`player-status ${player.isReady ? 'ready' : ''}`}>
                    {player.isReady ? '✓ Готов' : '○ Не готов'}
                  </span>
                </div>
              ))}
            </div>

            {isHost ? (
              <div className="host-controls">
                <h3>Выберите категорию:</h3>
                <div className="categories">
                  {(Object.keys(categoryNames) as Category[]).map((category) => (
                    <button
                      key={category}
                      className={`category-btn ${selectedCategoryMp === category ? 'selected' : ''}`}
                      onClick={() => handleSelectCategory(category)}
                    >
                      <span className="category-icon">{categoryIcons[category]}</span>
                      <span>{categoryNames[category]}</span>
                    </button>
                  ))}
                </div>

                {selectedCategoryMp && (
                  <div>
                    <h3>Количество вопросов:</h3>
                    <div className="question-count-selector">
                      {QUESTION_OPTIONS.map((count) => (
                        <button
                          key={count}
                          className={`count-btn ${mpQuestionsCount === count ? 'selected' : ''}`}
                          onClick={() => setMpQuestionsCount(count)}
                        >
                          {count}
                        </button>
                      ))}
                    </div>
                    
                    <p className="ready-status" style={{ 
                      color: players.every(p => p.isReady) ? '#4ecdc4' : '#ff6b6b',
                      marginBottom: '15px',
                      textAlign: 'center'
                    }}>
                      {players.every(p => p.isReady) 
                        ? `✓ Все готовы (${players.length}/${players.length})` 
                        : `○ Ждём игроков (${players.filter(p => p.isReady).length}/${players.length})`}
                    </p>
                    <button
                      className="start-btn"
                      onClick={handleStartMultiplayer}
                      disabled={players.length < 2 || !players.every(p => p.isReady)}
                      style={{ 
                        opacity: players.length < 2 || !players.every(p => p.isReady) ? 0.5 : 1,
                        cursor: players.length < 2 || !players.every(p => p.isReady) ? 'not-allowed' : 'pointer'
                      }}
                    >
                      🎮 Начать игру
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <p className="waiting-message">Ожидайте выбора категории хостом...</p>
            )}

            <div className="ready-section">
              <button 
                className={`ready-btn ${isReady ? 'ready' : ''}`}
                onClick={handleToggleReady}
              >
                {isReady ? '✓ Вы готовы' : '○ Я готов'}
              </button>
              
              <button className="leave-btn" onClick={handleLeaveRoom}>
                🚪 Покинуть комнату
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Рендер выбора режима мультиплеера (создать или подключиться)
  if (multiplayerMode === 'menu') {
    return (
      <div className="app">
        <div className="game-container">
          <div className="multiplayer-screen">
            <h2>👥 Игра с друзьями</h2>
            <p style={{ color: '#a0a0a0', marginBottom: '30px' }}>
              Создай комнату или подключись к существующей
            </p>

            <div className="mp-buttons">
              <button className="start-btn" onClick={() => setMultiplayerMode('create')}>
                🏠 Создать комнату
              </button>

              <button className="start-btn" onClick={() => setMultiplayerMode('join')}>
                🚪 Подключиться к комнате
              </button>

              <button className="back-btn" onClick={() => setMultiplayerMode('none')}>
                ⬅️ Назад в меню
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Рендер создания/подключения к комнате
  if (multiplayerMode === 'create' || multiplayerMode === 'join') {
    return (
      <div className="app">
        <div className="game-container">
          <div className="multiplayer-screen">
            <h2>{multiplayerMode === 'create' ? 'Создание комнаты' : 'Подключение к комнате'}</h2>
            
            <div className={`connection-status ${isConnected ? 'connected' : ''}`}>
              {isConnected ? '🟢 Подключено' : '🔴 Нет подключения'}
            </div>

            <div className="input-group">
              <label>Ваше имя:</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Введите имя"
                maxLength={20}
              />
            </div>

            {multiplayerMode === 'join' && (
              <div className="input-group">
                <label>Код комнаты:</label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="123456"
                  maxLength={6}
                />
              </div>
            )}

            {error && <div className="error-message">{error}</div>}

            <div className="mp-buttons">
              {multiplayerMode === 'create' ? (
                <button className="start-btn" onClick={handleCreateRoom} disabled={!isConnected}>
                  🏠 Создать комнату
                </button>
              ) : (
                <button className="start-btn" onClick={handleJoinRoom} disabled={!isConnected}>
                  🚪 Войти в комнату
                </button>
              )}

              <button className="back-btn" onClick={() => {
                setMultiplayerMode('none');
                setError('');
              }}>
                ⬅️ Назад
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Рендер игры (мультиплеер)
  if (gameState === 'playing' || gameState === 'buzz') {
    return (
      <div className="app">
        <div className="game-container">
          <div className="mp-game-screen">
            <div className="game-header">
              <div className="question-counter">
                Вопрос {mpQuestionIndex + 1} из {_mpQuestions.length || mpQuestionsCount}
              </div>
              <div className="category-badge-mp">
                {categoryIcons[selectedCategoryMp!]} {selectedCategoryMp && categoryNames[selectedCategoryMp]}
              </div>
            </div>

            {currentMpQuestion && (
              <div className="question-container">
                <h3 className="question-text">{currentMpQuestion.question}</h3>
              </div>
            )}

            {/* Кнопка для нажатия (buzz-in) - показываем ТОЛЬКО когда можно нажать */}
            {gameState === 'playing' && !buzzedPlayer && !isBuzzingBlocked && canBuzz && !hasBuzzed && (
              <button
                className={`buzz-btn active`}
                onClick={handleBuzz}
              >
                🖐 НАЖМИ ПЕРВЫМ!
              </button>
            )}

            {/* Индикатор что идёт загрузка вопроса - показываем ТОЛЬКО во время блокировки */}
            {gameState === 'playing' && !buzzedPlayer && isBuzzingBlocked && (
              <div className="question-loading">
                <div className="loading-spinner"></div>
                <p>Загрузка вопроса...</p>
              </div>
            )}

            {/* Игрок нажал - показывает кто (видят ВСЕ) */}
            {buzzedPlayer && !answerResult && (
              <div className="buzzed-info">
                <div className="buzzed-player">
                  🎯 {buzzedPlayer.name} отвечает!
                </div>

                {buzzedPlayer.id === socket?.id && (
                  <div className="answer-timer">
                    Время на ответ: <span className={answerTimeLeft <= 3 ? 'time-low' : ''}>{answerTimeLeft}с</span>
                  </div>
                )}
              </div>
            )}

            {/* Варианты ответа ТОЛЬКО для игрока который нажал */}
            {buzzedPlayer?.id === socket?.id && currentMpQuestion && !answerResult && (
              <div className="answers">
                {currentMpQuestion.options.map((option, index) => (
                  <button
                    key={index}
                    className="answer-btn"
                    onClick={() => handleSubmitAnswer(index)}
                    disabled={isAnswerLocked}
                  >
                    {option}
                  </button>
                ))}
                <button className="skip-btn" onClick={handleSkipAnswer} disabled={isAnswerLocked}>
                  ⏭️ Пропустить
                </button>
              </div>
            )}

            {/* Показ результата ответа для ВСЕХ игроков */}
            {answerResult && answerResult.question && (
              <div className="answer-result">
                <div className={`result-message ${answerResult.correct ? 'correct' : 'wrong'}`}>
                  {answerResult.correct ? (
                    <span>✅ {answerResult.answeringPlayer?.name} ответил правильно!</span>
                  ) : (
                    <span>❌ {answerResult.answeringPlayer?.name || 'Игрок'} ошибся!</span>
                  )}
                </div>
                <div className="correct-answer-display">
                  Правильный ответ: <strong>{answerResult.question?.options[answerResult.correctAnswer ?? 0]}</strong>
                </div>
                <div className="auto-next-timer">
                  Следующий вопрос через: <span className="timer-count">{autoNextTimer}</span>
                </div>
              </div>
            )}

            {/* Список игроков с очками */}
            <div className="players-scoreboard">
              <h4>Счёт:</h4>
              {[...players].sort((a, b) => b.score - a.score).map((player, index) => (
                <div key={player.id} className={`scoreboard-item ${player.id === socket?.id ? 'current' : ''}`}>
                  <span className="score-rank">{index + 1}.</span>
                  <span className="score-name">
                    {player.isHost && '👑 '}
                    {player.name}
                    {player.id === socket?.id && ' (Вы)'}
                  </span>
                  <span className="score-value">{player.score}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Рендер результатов мультиплеера
  if (gameState === 'finished' && gameResults.length > 0) {
    const winner = gameResults[0];
    const isDraw = gameResults.length > 1 && gameResults.length >= 2 && gameResults[0].score === gameResults[1].score;

    return (
      <div className="app">
        <div className="game-container">
          <div className="result-screen-mp">
            <div className="result-header">
              <h2>🏆 Игра окончена!</h2>
              {isDraw ? (
                <p className="result-subtitle">🤝 Ничья!</p>
              ) : (
                <p className="result-subtitle">
                  Победитель: <strong>{winner?.name || 'Неизвестно'}</strong>
                </p>
              )}
            </div>

            <div className="result-content">
              <div className="winner-display">
                {isDraw ? (
                  <div className="draw-info">
                    <p className="draw-text">Все игроки набрали одинаковое количество очков!</p>
                  </div>
                ) : (
                  <div className="winner-info">
                    <div className="winner-avatar">🥇</div>
                    <h3 className="winner-name">{winner?.name}</h3>
                    <p className="winner-score">{winner?.score} очков</p>
                    <p className="winner-stats">
                      ✅ {Math.floor(winner.score / 10)}/{mpQuestionsCount} правильных ответов
                    </p>
                  </div>
                )}
              </div>

              <div className="final-standings">
                <h3>📊 Все игроки:</h3>
                {gameResults.map((player, index) => (
                  <div
                    key={player.id}
                    className={`standing-item ${player.id === socket?.id ? 'current' : ''} rank-${index + 1}`}
                  >
                    <span className="standing-rank">
                      {index === 0 && !isDraw ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}
                    </span>
                    <span className="standing-name">
                      {player.isHost && '👑 '}
                      {player.name}
                      {player.id === socket?.id && ' (Вы)'}
                    </span>
                    <span className="standing-score">{player.score} оч.</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="result-buttons">
              {isHost && (
                <>
                  <button className="restart-btn" onClick={() => {
                    // Возврат в лобби для выбора новой темы
                    setSelectedCategoryMp(null);
                    setGameState('lobby');
                    setGameResults([]);
                    console.log('🔄 Возврат в лобби для выбора новой темы');
                  }}>
                    🔄 Выбрать другую тему
                  </button>
                  <button className="restart-btn" onClick={() => {
                    // Начать заново с той же категорией
                    const categoryQuestions = shuffle(
                      questions.filter((q) => q.category === selectedCategoryMp)
                    ).slice(0, mpQuestionsCount);
                    socket?.emit('startGame', { questions: categoryQuestions, count: mpQuestionsCount });
                  }}>
                    🔄 Играть снова (та же тема)
                  </button>
                </>
              )}
              <button className="restart-btn" onClick={handleBackToMenu}>
                🏠 В главное меню
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Рендер главного меню
  if (gameState === 'menu') {
    return (
      <div className="app">
        <div className="game-container">
          <div className="start-screen">
            <h1>🎯 Викторина</h1>
            <p>Проверь свои знания!</p>

            <div className="menu-buttons">
              <button className="start-btn" onClick={handleStartSolo}>
                🎮 Одиночная игра
              </button>

              <button className="start-btn multiplayer-btn" onClick={() => setMultiplayerMode('menu')}>
                👥 Игра с друзьями
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Рендер выбора категории для соло
  if (gameState === 'category') {
    return (
      <div className="app">
        <div className="game-container">
          <div className="category-screen">
            <h2>Выберите категорию</h2>
            <div className="categories">
              {(Object.keys(categoryNames) as Category[]).map((category) => (
                <button
                  key={category}
                  className={`category-btn ${pendingSoloCategory === category ? 'selected' : ''}`}
                  onClick={() => setPendingSoloCategory(category)}
                >
                  <span className="category-icon">{categoryIcons[category]}</span>
                  <span>{categoryNames[category]}</span>
                </button>
              ))}
            </div>

            {pendingSoloCategory && (
              <div>
                <h3>Количество вопросов:</h3>
                <div className="question-count-selector">
                  {QUESTION_OPTIONS.map((count) => (
                    <button
                      key={count}
                      className={`count-btn ${soloQuestionsCount === count ? 'selected' : ''}`}
                      onClick={() => setSoloQuestionsCount(count)}
                    >
                      {count}
                    </button>
                  ))}
                </div>
                <button
                  className="start-btn"
                  style={{ marginTop: '15px' }}
                  onClick={() => handleCategorySelectSolo(pendingSoloCategory, soloQuestionsCount)}
                >
                  🎮 Начать игру
                </button>
              </div>
            )}

            <button className="back-btn" style={{ marginTop: '20px' }} onClick={() => { setGameState('menu'); setPendingSoloCategory(null); }}>
              ⬅️ Назад
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Рендер результатов соло
  if (gameState === 'finished' && multiplayerMode === 'none') {
    return (
      <div className="app">
        <div className="game-container">
          <div className="result-screen">
            <h2>🏆 Результаты</h2>
            <div className="result-content">
              <p className="result-category">
                Категория: {selectedCategory && categoryNames[selectedCategory]}
              </p>
              <p className="result-score">
                Ваш счёт: <strong>{score}</strong> из {currentQuestions.length}
              </p>
              <p className="result-percentage">
                {Math.round((score / currentQuestions.length) * 100)}% правильных ответов
              </p>
            </div>
            <button className="restart-btn" onClick={handleRestartSolo}>
              🔄 В главное меню
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Рендер одиночной игры
  if (gameState === 'solo' && currentQuestion) {
    return (
      <div className="app">
        <div className="game-container">
          <div className="game-screen">
            <div className="game-header">
              <div className="timer">
                ⏱️ <span className={timeLeft <= 10 ? 'time-low' : ''}>{formatTime(timeLeft)}</span>
              </div>
              <div className="progress">
                Вопрос {currentQuestionIndex + 1} из {currentQuestions.length}
              </div>
              <div className="score">Очки: {score}</div>
            </div>

            <div className="question-container">
              <span className="category-badge">
                {categoryIcons[selectedCategory!]} {categoryNames[selectedCategory!]}
              </span>
              <h3 className="question-text">{currentQuestion.question}</h3>
            </div>

            <div className="answers">
              {currentQuestion.options.map((option, index) => (
                <button
                  key={index}
                  className={getButtonClass(index)}
                  onClick={() => handleAnswerSelect(index)}
                  disabled={showResult}
                >
                  {option}
                </button>
              ))}
            </div>

            {showResult && (
              <button className="next-btn" onClick={handleNextQuestionSolo}>
                {currentQuestionIndex < currentQuestions.length - 1 ? '➡️ Далее' : '🏆 Результаты'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default App;
