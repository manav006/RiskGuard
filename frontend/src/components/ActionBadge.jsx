export function actionLabel(action) {
  switch (action) {
    case 'auto_submit_defense':
      return 'Auto-Submit Defense'
    case 'route_to_human_review':
      return 'Route to Human Review'
    case 'accept_chargeback':
      return 'Accept Chargeback'
    default:
      return action || 'Unknown'
  }
}

export default function ActionBadge({ action }) {
  if (!action) return null
  let cls = 'action-badge'
  if (action === 'auto_submit_defense') cls += ' action-defense'
  else if (action === 'route_to_human_review') cls += ' action-review'
  else if (action === 'accept_chargeback') cls += ' action-accept'
  return <span className={cls}>{actionLabel(action)}</span>
}
