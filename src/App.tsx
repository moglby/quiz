import { useState, useEffect } from 'react';
import './App.css';
import {
  questions,
  type Category,
  type Question,
  categoryNames,
  categoryIcons,
} from './data/questions';

type GameState = 'start' | 'category' | 'playing' | 'result';

// Хранилище использованных вопросов для каждой категории
let usedQuestionIds: Record<Category, number[]> = {
  programming: [],
  games: [],
  math: [],
  movies: [],
};

function App() {
  const [gameState, setGameState] = useState<GameState>('start');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [currentQuestions, setCurrentQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);

  const currentQuestion = currentQuestions[currentQuestionIndex];

  useEffect(() => {
    if (gameState === 'playing' && !showResult && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && !showResult) {
      handleTimeUp();
    }
  }, [timeLeft, gameState, showResult]);

  const handleStart = () => {
    setGameState('category');
  };

  const handleCategorySelect = (category: Category) => {
    setSelectedCategory(category);
    
    // Получаем все вопросы категории
    const categoryQuestions = questions.filter((q) => q.category === category);
    // Фильтруем неиспользованные вопросы
    const availableQuestions = categoryQuestions.filter(
      (q) => !usedQuestionIds[category].includes(q.id)
    );
    
    // Если все вопросы использованы, сбрасываем
    if (availableQuestions.length < 10) {
      usedQuestionIds[category] = [];
    }
    
    // Перемешиваем и берём 10 вопросов
    const shuffled = [...questions]
      .filter((q) => q.category === category && !usedQuestionIds[category].includes(q.id))
      .sort(() => Math.random() - 0.5);
    const selectedQuestions = shuffled.slice(0, 10);
    
    // Сохраняем ID использованных вопросов
    selectedQuestions.forEach((q) => {
      if (!usedQuestionIds[category].includes(q.id)) {
        usedQuestionIds[category].push(q.id);
      }
    });
    
    setCurrentQuestions(selectedQuestions);
    setCurrentQuestionIndex(0);
    setScore(0);
    setGameState('playing');
    setTimeLeft(30);
    setSelectedAnswer(null);
    setShowResult(false);
  };

  const handleAnswerSelect = (answerIndex: number) => {
    if (showResult) return;
    
    setSelectedAnswer(answerIndex);
    setShowResult(true);

    if (answerIndex === currentQuestion.correctAnswer) {
      setScore(score + 1);
    }
  };

  const handleTimeUp = () => {
    setShowResult(true);
    setSelectedAnswer(-1);
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < currentQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setTimeLeft(30);
      setSelectedAnswer(null);
      setShowResult(false);
    } else {
      setGameState('result');
    }
  };

  const handleRestart = () => {
    setGameState('start');
    setSelectedCategory(null);
    setCurrentQuestions([]);
    setCurrentQuestionIndex(0);
    setScore(0);
    setTimeLeft(30);
    setSelectedAnswer(null);
    setShowResult(false);
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

  return (
    <div className="app">
      <div className="side-decoration left"></div>
      <div className="side-decoration right"></div>
      
      <div className="game-container">
        {gameState === 'start' && (
          <div className="start-screen">
            <h1>🎯 Викторина</h1>
            <p>Проверь свои знания!</p>
            <button className="start-btn" onClick={handleStart}>
              🚀 Старт
            </button>
          </div>
        )}

        {gameState === 'category' && (
        <div className="category-screen">
          <h2>Выберите категорию</h2>
          <div className="categories">
            {(Object.keys(categoryNames) as Category[]).map((category) => (
              <button
                key={category}
                className="category-btn"
                onClick={() => handleCategorySelect(category)}
              >
                <span className="category-icon">{categoryIcons[category]}</span>
                <span>{categoryNames[category]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {gameState === 'playing' && currentQuestion && (
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
            <button className="next-btn" onClick={handleNextQuestion}>
              {currentQuestionIndex < currentQuestions.length - 1 ? '➡️ Далее' : '🏆 Результаты'}
            </button>
          )}
        </div>
      )}

      {gameState === 'result' && (
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
          <button className="restart-btn" onClick={handleRestart}>
            🔄 Играть снова
          </button>
        </div>
      )}
      </div>
    </div>
  );
}

export default App;
