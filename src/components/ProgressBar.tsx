interface ProgressBarProps {
  current: number;
  total: number;
  timeLeft: number;
}

export default function ProgressBar({ current, total, timeLeft }: ProgressBarProps) {
  const progress = (current / total) * 100;
  const timePercentage = (timeLeft / 15) * 100;
  const timeColor = timeLeft > 5 ? 'bg-green-500' : timeLeft > 3 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="mb-6">
      <div className="flex justify-between text-sm text-gray-600 mb-2">
        <span>Вопрос {current} из {total}</span>
        <span className={`font-bold ${timeLeft <= 5 ? 'text-red-600' : 'text-gray-600'}`}>
          ⏱ {timeLeft}с
        </span>
      </div>
      
      <div className="h-2 bg-gray-200 rounded-full mb-3 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${timeColor} transition-all duration-1000`}
          style={{ width: `${timePercentage}%` }}
        />
      </div>
    </div>
  );
}
