export function riskLevel(probability) {
  if (probability >= 0.9) return 'high'
  if (probability >= 0.7) return 'medium'
  return 'low'
}

export default function RiskBadge({ probability }) {
  const level = riskLevel(probability)
  const label = `${(probability * 100).toFixed(1)}%`
  return (
    <span className={`risk-badge risk-${level}`}>
      <span className="risk-dot" />
      {label}
    </span>
  )
}
