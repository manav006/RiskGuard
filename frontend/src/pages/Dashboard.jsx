import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from 'recharts'
import { fetchData } from '../api'
import StatCard from '../components/StatCard.jsx'
import Loading from '../components/Loading.jsx'
import ErrorMessage from '../components/ErrorMessage.jsx'
import { formatINR, formatNumber, formatPercent } from '../utils'

const RISK_COLORS = ['#ef4444', '#f59e0b', '#10b981']

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchData('/api/dashboard-summary')
      .then(setData)
      .catch((e) => setError(e.message))
  }, [])

  if (error) return <ErrorMessage message={error} />
  if (!data) return <Loading />

  const actionBreakdown = [
    { name: 'Auto-Submit Defense', value: data.action_breakdown.auto_submit_defense },
    { name: 'Route to Human Review', value: data.action_breakdown.route_to_human_review },
    { name: 'Accept Chargeback', value: data.action_breakdown.accept_chargeback },
  ]

  const tpFpData = [
    { name: 'True Positives (Fraud)', value: data.true_positive_count },
    { name: 'False Positives (Review)', value: data.false_positive_count },
  ]

  return (
    <div className="dashboard">
      <div className="page-head">
        <div>
          <h1>Risk Overview</h1>
          <p className="muted">Fraud detection performance across the transaction network</p>
        </div>
        <Link to="/transactions" className="btn btn-primary">View Flagged Transactions →</Link>
      </div>

      <div className="stat-grid">
        <StatCard label="Total Transactions" value={formatNumber(data.total_transactions)} />
        <StatCard label="Flagged" value={formatNumber(data.flagged_count)} tone="danger" />
        <StatCard label="Precision" value={formatPercent(data.model_precision)} sub="Share of flags that are real fraud" />
        <StatCard label="Recall" value={formatPercent(data.model_recall)} sub="Share of fraud caught by the model" />
        <StatCard label="Fraud Loss Prevented" value={formatINR(data.estimated_fraud_loss_prevented_inr)} tone="success" sub="Estimated value of caught fraud" />
        <StatCard label="Friction Cost" value={formatINR(data.estimated_friction_cost_inr)} tone="warn" sub="Cost of wrongly flagging legit customers" />
      </div>

      <div className="chart-grid">
        <div className="panel">
          <h3 className="panel-title">Recommended Actions</h3>
          <p className="muted">How the AI suggests handling each flagged transaction</p>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={actionBreakdown}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label
              >
                {actionBreakdown.map((entry, i) => (
                  <Cell key={`cell-${i}`} fill={RISK_COLORS[i % RISK_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="panel">
          <h3 className="panel-title">Honest Metrics</h3>
          <p className="muted">True positives vs false positives among flagged transactions</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={tpFpData}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" name="Transactions" radius={[6, 6, 0, 0]}>
                <Cell fill="#ef4444" />
                <Cell fill="#f59e0b" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="legend-note">
            <span className="dot-red" /> Confirmed fraud (red) —{' '}
            <span className="dot-amber" /> wrongly flagged (amber, needs review)
          </div>
        </div>
      </div>
    </div>
  )
}
