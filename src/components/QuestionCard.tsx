import type { Question } from '../types/quiz';

interface QuestionCardProps {
  question: Question;
  onAnswer: (index: number | null) => void;
  questionNumber: number;
  totalQuestions: number;
}

export default function QuestionCard({ question, onAnswer, questionNumber, totalQuestions }: QuestionCardProps) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-700 mb-6">
        <span className="text-purple-600">#{questionNumber}</span> {question.question}
      </h2>

      <div className="space-y-3">
        {question.options.map((option, index) => (
          <button
            key={index}
            onClick={() => onAnswer(index)}
            className="w-full p-4 text-left border-2 border-gray-200 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-all duration-200 font-medium text-gray-700 hover:shadow-md"
          >
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-purple-600 font-bold mr-3 text-sm">
              {String.fromCharCode(65 + index)}
            </span>
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
