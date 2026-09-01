import ActionBadge from './ActionBadge.jsx'

export default function EvidencePacketView({ packet }) {
  if (!packet) return null

  const fields = packet.evidence_packet || {}
  const sections = [
    { key: 'transaction_details', title: 'Transaction Details' },
    { key: 'delivery_evidence', title: 'Delivery Evidence' },
    { key: 'identity_verification_evidence', title: 'Identity Verification' },
    { key: 'customer_engagement_evidence', title: 'Customer Engagement' },
    { key: 'recommended_dispute_response', title: 'Recommended Dispute Response' },
  ]

  return (
    <div className="panel evidence-panel">
      <div className="evidence-head">
        <div>
          <h3 className="panel-title">AI Recommendation</h3>
          <p className="muted">Automatically drafted chargeback evidence packet</p>
        </div>
        <ActionBadge action={packet.recommended_action} />
      </div>

      {packet.confidence_note && (
        <div className="confidence-note">
          <strong>Confidence:</strong> {packet.confidence_note}
        </div>
      )}
      {packet.evidence_summary && (
        <p className="evidence-summary">{packet.evidence_summary}</p>
      )}

      <div className="evidence-sections">
        {sections.map(({ key, title }) => (
          <div className="evidence-section" key={key}>
            <div className="evidence-section-title">{title}</div>
            <p className="evidence-section-body">
              {fields[key] || 'No details provided.'}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
