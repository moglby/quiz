import { useState, useEffect } from 'react';
import type { Question } from '../types/quiz';
import questionsData from '../data/questions.json';

export function useQuiz() {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [timeLeft, setTimeLeft] = useState(15);
  const [isPaused, setIsPaused] = useState(false);

  const questions: Question[] = questionsData;

  useEffect(() => {
    if (showResult || isPaused) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleAnswer(null);
          return 15;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentQuestion, showResult, isPaused]);

  const handleAnswer = (answerIndex: number | null) => {
    setIsPaused(true);
    
    const newAnswers = [...answers];
    newAnswers[currentQuestion] = answerIndex;
    setAnswers(newAnswers);

    if (answerIndex !== null && answerIndex === questions[currentQuestion].correctAnswer) {
      setScore((prev) => prev + 1);
    }

    setTimeout(() => {
      if (currentQuestion < questions.length - 1) {
        setCurrentQuestion((prev) => prev + 1);
        setTimeLeft(15);
        setIsPaused(false);
      } else {
        setShowResult(true);
      }
    }, 500);
  };

  const restartQuiz = () => {
    setCurrentQuestion(0);
    setScore(0);
    setShowResult(false);
    setAnswers([]);
    setTimeLeft(15);
    setIsPaused(false);
  };

  return {
    questions,
    currentQuestion,
    score,
    showResult,
    answers,
    timeLeft,
    handleAnswer,
    restartQuiz,
  };
}
