interface ScoreBarProps {
  score: number
  max?: number
  label?: string
  showValue?: boolean
}

export function ScoreBar({ score, max = 10, label, showValue = true }: ScoreBarProps) {
  const percentage = (score / max) * 100
  const colorClass =
    percentage >= 70 ? 'bg-green-500' :
    percentage >= 50 ? 'bg-yellow-500' :
    percentage >= 30 ? 'bg-orange-500' :
    'bg-red-500'

  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-600">{label}</span>
          {showValue && <span className="font-medium">{score.toFixed(1)}/{max}</span>}
        </div>
      )}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`${colorClass} h-2 rounded-full transition-all`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
