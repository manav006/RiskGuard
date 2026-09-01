export default function OutcomeBadge({ outcome }) {
  if (outcome === 'true_positive') {
    return <span className="outcome-badge outcome-fraud">Fraud Confirmed</span>
  }
  if (outcome === 'false_positive') {
    return <span className="outcome-badge outcome-review">Needs Review</span>
  }
  return <span className="outcome-badge outcome-unknown">Unknown</span>
}
