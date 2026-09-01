export default function FalsePositiveCallout() {
  return (
    <div className="callout callout-fp">
      <div className="callout-icon" aria-hidden="true">!</div>
      <div className="callout-body">
        <h4>Flagged but not fraudulent</h4>
        <p>
          This transaction was flagged by the model but is <strong>not actually fraud</strong>.
          The system recognized its own mistake and routed it to <strong>human review</strong> rather
          than auto-contesting a legitimate customer's chargeback. This is the risk
          system working as intended.
        </p>
      </div>
    </div>
  )
}
