interface ResultProps {
  score: number;
  total: number;
  onRestart: () => void;
}

export default function Result({ score, total, onRestart }: ResultProps) {
  const percentage = Math.round((score / total) * 100);
  
  let message = '';
  let emoji = '';
  
  if (percentage === 100) {
    message = 'Идеально!';
    emoji = '🏆';
  } else if (percentage >= 80) {
    message = 'Отлично!';
    emoji = '🎉';
  } else if (percentage >= 60) {
    message = 'Хорошо!';
    emoji = '👍';
  } else if (percentage >= 40) {
    message = 'Неплохо';
    emoji = '📚';
  } else {
    message = 'Попробуй ещё раз';
    emoji = '💪';
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
        <div className="text-6xl mb-4">{emoji}</div>
        
        <h2 className="text-3xl font-bold text-gray-800 mb-2">
          {message}
        </h2>
        
        <p className="text-gray-600 mb-6">
          Ты ответил правильно на {score} из {total} вопросов
        </p>

        <div className="mb-8">
          <div className="relative w-32 h-32 mx-auto">
            <svg className="w-full h-full" viewBox="0 0 100 100">
              <circle
                className="text-gray-200"
                strokeWidth="8"
                stroke="currentColor"
                fill="transparent"
                r="42"
                cx="50"
                cy="50"
              />
              <circle
                className="text-purple-600 transition-all duration-1000"
                strokeWidth="8"
                strokeDasharray={264}
                strokeDashoffset={264 - (264 * percentage) / 100}
                strokeLinecap="round"
                stroke="currentColor"
                fill="transparent"
                r="42"
                cx="50"
                cy="50"
                transform="rotate(-90 50 50)"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-3xl font-bold text-gray-800">{percentage}%</span>
            </div>
          </div>
        </div>

        <button
          onClick={onRestart}
          className="w-full py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl"
        >
          🔄 Пройти ещё раз
        </button>
      </div>
    </div>
  );
}
