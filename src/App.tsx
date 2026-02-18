import { useQuiz } from './hooks/useQuiz';
import ProgressBar from './components/ProgressBar';
import QuestionCard from './components/QuestionCard';
import Result from './components/Result';

function App() {
  const {
    questions,
    currentQuestion,
    score,
    showResult,
    timeLeft,
    handleAnswer,
    restartQuiz,
  } = useQuiz();

  if (showResult) {
    return <Result score={score} total={questions.length} onRestart={restartQuiz} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">
          Quiz App
        </h1>
        
        <ProgressBar
          current={currentQuestion + 1}
          total={questions.length}
          timeLeft={timeLeft}
        />

        <QuestionCard
          question={questions[currentQuestion]}
          onAnswer={handleAnswer}
          questionNumber={currentQuestion + 1}
          totalQuestions={questions.length}
        />

        <div className="mt-4 text-center text-gray-600">
          Очки: <span className="font-bold text-purple-600">{score}</span>
        </div>
      </div>
    </div>
  );
}

export default App;
