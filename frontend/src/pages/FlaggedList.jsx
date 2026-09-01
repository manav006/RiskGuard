import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchData } from '../api'
import RiskBadge from '../components/RiskBadge.jsx'
import OutcomeBadge from '../components/OutcomeBadge.jsx'
import Loading from '../components/Loading.jsx'
import ErrorMessage from '../components/ErrorMessage.jsx'
import { formatNumber } from '../utils'

export default function FlaggedList() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortKey, setSortKey] = useState('fraud_probability')
  const [sortDir, setSortDir] = useState('desc')
  const navigate = useNavigate()

  useEffect(() => {
    fetchData('/api/flagged')
      .then(setData)
      .catch((e) => setError(e.message))
  }, [])

  const rows = useMemo(() => {
    if (!data) return []
    let filtered = data
    if (statusFilter === 'true_positive') {
      filtered = data.filter((t) => t.outcome === 'true_positive')
    } else if (statusFilter === 'false_positive') {
      filtered = data.filter((t) => t.outcome === 'false_positive')
    }
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? ''
      const bv = b[sortKey] ?? ''
      let cmp = 0
      if (typeof av === 'number' && typeof bv === 'number') {
        cmp = av - bv
      } else {
        cmp = String(av).localeCompare(String(bv))
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [data, statusFilter, sortKey, sortDir])

  if (error) return <ErrorMessage message={error} />
  if (!data) return <Loading />

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sortArrow = (key) => (sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '')

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Flagged Transactions</h1>
          <p className="muted">{formatNumber(data.length)} flagged for review</p>
        </div>
      </div>

      <div className="filters">
        <span className="filter-label">Filter:</span>
        {[
          { key: 'all', label: 'All' },
          { key: 'true_positive', label: 'Fraud Confirmed' },
          { key: 'false_positive', label: 'Needs Review' },
        ].map((f) => (
          <button
            key={f.key}
            className={`filter-btn ${statusFilter === f.key ? 'active' : ''}`}
            onClick={() => setStatusFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th onClick={() => toggleSort('order_id')}>Order ID{sortArrow('order_id')}</th>
              <th onClick={() => toggleSort('merchant_id')}>Merchant{sortArrow('merchant_id')}</th>
              <th onClick={() => toggleSort('fraud_probability')}>Risk{sortArrow('fraud_probability')}</th>
              <th onClick={() => toggleSort('amount')}>Amount{sortArrow('amount')}</th>
              <th onClick={() => toggleSort('outcome')}>Status{sortArrow('outcome')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.order_id} onClick={() => navigate(`/transactions/${t.order_id}`)} className="clickable-row">
                <td className="mono">{t.order_id}</td>
                <td className="mono">{t.merchant_id}</td>
                <td><RiskBadge probability={t.fraud_probability} /></td>
                <td>{formatNumber(t.amount)}</td>
                <td><OutcomeBadge outcome={t.outcome} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="table-footer">
        Showing {rows.length} of {data.length} flagged transactions
      </div>
    </div>
  )
}
