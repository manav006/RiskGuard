import { useEffect, useMemo, useState } from 'react'
import { fetchData } from '../api'
import Loading from '../components/Loading.jsx'
import ErrorMessage from '../components/ErrorMessage.jsx'

const STATUS_CLASS_MAP = {
  captured: 'pay-status-captured',
  failed: 'pay-status-failed',
  authorized: 'pay-status-authorized',
  refunded: 'pay-status-refunded',
}

function StatusBadge({ status }) {
  const cls = STATUS_CLASS_MAP[status] || 'pay-status-refunded'
  return <span className={`pay-status-badge ${cls}`}>{status}</span>
}

function formatDate(createdAt) {
  if (!createdAt) return '—'
  return new Date(createdAt * 1000).toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatAmount(amountPaise) {
  const rupees = (amountPaise || 0) / 100
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(rupees)
}

function methodLabel(payment) {
  if (payment.method === 'upi' && payment.vpa) return `UPI · ${payment.vpa}`
  if (payment.method === 'netbanking' && payment.bank) return `Netbanking · ${payment.bank}`
  if (payment.method === 'wallet' && payment.wallet) return `Wallet · ${payment.wallet}`
  if (payment.method === 'card' && payment.card) return `Card ·${payment.card.last4 ? ` •••• ${payment.card.last4}` : ''}`
  return payment.method
}

export default function LiveTransactions() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchData('/api/razorpay/test-payments')
      .then(setData)
      .catch((e) => setError(e.message))
  }, [])

  const payments = useMemo(() => (data?.payments || []), [data])

  if (error) return <ErrorMessage message={error} />
  if (!data) return <Loading />

  const isLive = data.source === 'live'

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Razorpay Test Transactions</h1>
          <p className="muted">Realistic Razorpay-schema payments via <span className="mono">/api/razorpay/test-payments</span></p>
        </div>
      </div>

      {isLive ? (
        <div className="live-badge">Connected to live Razorpay test account</div>
      ) : (
        <div className="mock-banner">
          <div className="mock-banner-icon">ⓘ</div>
          <div className="mock-banner-body">
            <h4>Demo Mode</h4>
            <p>Showing Razorpay-schema-accurate mock transaction data. Real-account integration is fully built and will activate automatically once Razorpay test API keys are added — see README for details.</p>
          </div>
        </div>
      )}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Payment ID</th>
              <th>Amount</th>
              <th>Method</th>
              <th>Status</th>
              <th>Created At</th>
              <th>Contact</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <td className="mono">{p.id}</td>
                <td>{formatAmount(p.amount)}</td>
                <td>{methodLabel(p)}</td>
                <td><StatusBadge status={p.status} /></td>
                <td>{formatDate(p.created_at)}</td>
                <td>
                  {p.email ? (
                    <span className="mono">{p.email}<br /></span>
                  ) : null}
                  {p.contact ? <span className="mono muted">{p.contact}</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="table-footer">
        Showing {payments.length} payments · {isLive ? 'live Razorpay data' : 'schema-accurate mock data'}
      </div>

      <div className="panel note-panel">
        <p>Fraud scoring for these transactions is a planned next step — currently only the historical synthetic dataset (see Transactions page) is scored by the model.</p>
      </div>
    </div>
  )
}
