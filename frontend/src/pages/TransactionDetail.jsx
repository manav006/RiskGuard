import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchData } from '../api'
import RiskBadge from '../components/RiskBadge.jsx'
import OutcomeBadge from '../components/OutcomeBadge.jsx'
import ExplainabilityPanel from '../components/ExplainabilityPanel.jsx'
import EvidencePacketView from '../components/EvidencePacketView.jsx'
import FalsePositiveCallout from '../components/FalsePositiveCallout.jsx'
import Loading from '../components/Loading.jsx'
import ErrorMessage from '../components/ErrorMessage.jsx'
import { formatNumber } from '../utils'

const FEATURE_LABELS = {
  amount: 'Amount',
  hour_of_day: 'Hour of Day',
  device_age_days: 'Device Age (days)',
  customer_account_age_days: 'Account Age (days)',
  ip_country_mismatch: 'IP/City Mismatch',
  billing_shipping_mismatch: 'Billing/Shipping Mismatch',
  velocity_txns_last_hour: 'Transactions Last Hour',
  amount_vs_customer_avg_ratio: 'vs. Customer’s Usual Spend',
  payment_method_risk_score: 'Payment Method Risk',
  cod_to_prepaid_flip: 'COD→Prepaid Flip',
  new_payment_instrument: 'New Payment Instrument',
  failed_attempts_before_success: 'Failed Attempts',
}

function formatBool(value) {
  if (value === 1 || value === true) return 'Yes'
  if (value === 0 || value === false) return 'No'
  return '—'
}

export default function TransactionDetail() {
  const { orderId } = useParams()
  const [tx, setTx] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchData(`/api/transactions/${orderId}`)
      .then(setTx)
      .catch((e) => setError(e.message))
  }, [orderId])

  if (error) return <ErrorMessage message={error} />
  if (!tx) return <Loading />

  const featureRows = Object.entries(FEATURE_LABELS)
    .filter(([key]) => key in tx)
    .map(([key, label]) => {
      const val = tx[key]
      let display = val
      if (typeof val === 'number') display = val.toFixed(2)
      if (key.includes('mismatch') || key === 'cod_to_prepaid_flip' || key === 'new_payment_instrument') {
        display = formatBool(val)
      }
      return { label, display }
    })

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <Link to="/transactions" className="back-link">← Back to flagged list</Link>
          <h1 className="mono page-title">{tx.order_id}</h1>
          <p className="muted mono">Merchant {tx.merchant_id}</p>
        </div>
        <div className="head-badges">
          <RiskBadge probability={tx.fraud_probability} />
          <OutcomeBadge outcome={tx.outcome} />
        </div>
      </div>

      {tx.outcome === 'false_positive' && <FalsePositiveCallout />}

      <div className="detail-grid">
        <div className="panel">
          <h3 className="panel-title">Transaction Summary</h3>
          <div className="feature-list">
            {featureRows.map(({ label, display }) => (
              <div className="feature-row" key={label}>
                <span className="feature-label">{label}</span>
                <span className="feature-value mono">{display}</span>
              </div>
            ))}
          </div>
        </div>

        <ExplainabilityPanel reasons={tx.top_reasons} />
      </div>

      {tx.evidence_packet ? (
        <EvidencePacketView packet={tx.evidence_packet} />
      ) : (
        <div className="panel">
          <h3 className="panel-title">AI Recommendation</h3>
          <p className="muted">
            No AI-drafted evidence available for this transaction (outside demo sample).
          </p>
        </div>
      )}
    </div>
  )
}
