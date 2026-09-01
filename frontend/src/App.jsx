import { Routes, Route, Link, NavLink } from 'react-router-dom'
import Dashboard from './pages/Dashboard.jsx'
import FlaggedList from './pages/FlaggedList.jsx'
import TransactionDetail from './pages/TransactionDetail.jsx'
import LiveTransactions from './pages/LiveTransactions.jsx'

function Navbar() {
  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="brand">
          <span className="brand-mark">R</span>
          <div className="brand-text">
            <span className="brand-name">RiskGuard</span>
            <span className="brand-sub">AI Chargeback Risk Manager</span>
          </div>
        </Link>
        <nav className="nav-links">
          <NavLink to="/" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')} end>
            Dashboard
          </NavLink>
          <NavLink to="/transactions" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
            Flagged Transactions
          </NavLink>
          <NavLink to="/live" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
            Razorpay Test Transactions
          </NavLink>
        </nav>
      </div>
    </header>
  )
}

export default function App() {
  return (
    <div className="app-shell">
      <Navbar />
      <main className="content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/transactions" element={<FlaggedList />} />
          <Route path="/transactions/:orderId" element={<TransactionDetail />} />
          <Route path="/live" element={<LiveTransactions />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  )
}

function NotFound() {
  return (
    <div className="empty-state">
      <h2>Page not found</h2>
      <p>The page you're looking for doesn't exist.</p>
      <Link to="/" className="btn btn-primary">Back to Dashboard</Link>
    </div>
  )
}
