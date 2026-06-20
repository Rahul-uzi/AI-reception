// src/pages/DashboardPage.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/shared/Sidebar'
import StatsBar from '../components/dashboard/StatsBar'
import CallTable from '../components/dashboard/CallTable'
import AnalyticsChart from '../components/dashboard/AnalyticsChart'
import CallDetail from '../components/dashboard/CallDetail'
import { fetchCalls, deleteCall } from '../lib/api'
import { useToast } from '../components/shared/Toast'
import { useAuthStore } from '../store/authStore'
import { Phone, RefreshCw } from 'lucide-react'

export default function DashboardPage() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  const isManager = useAuthStore(s => s.isManager())
  const [selected, setSelected] = useState(null)
  const [calls, setCalls] = useState([])
  const [loading, setLoading] = useState(true)

  async function loadCalls() {
    setLoading(true)
    try {
      const data = await fetchCalls()
      setCalls(data)

      // Keep the open modal in sync with fresh data.
      // When "Analyzing call..." becomes a real summary, the modal updates
      // automatically without the user having to close and reopen it.
      setSelected(prev =>
        prev ? (data.find(c => c.id === prev.id) ?? prev) : null
      )
    } catch (err) {
      addToast(`Architectural Error: ${err.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteCall(id) {
    try {
      await deleteCall(id)
      addToast('Call record deleted', 'success')
      loadCalls()
    } catch (err) {
      addToast(`Delete failed: ${err.message}`, 'error')
    }
  }

  useEffect(() => { loadCalls() }, [])



  return (
    <div className="app-shell">
      <Sidebar />

      <main className="app-content">

        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-sub">Overview of your AI Voice Agent</p>
          </div>
          <div className="flex gap-3">
            <button className="btn-ghost icon-btn" onClick={loadCalls}>
              <RefreshCw size={14} />
              Refresh
            </button>
            <button className="btn-primary icon-btn" onClick={() => navigate('/call')}>
              <Phone size={14} />
              New Call
            </button>
          </div>
        </div>

        {/* Stats */}
        <StatsBar calls={calls} />

        {/* Chart + Top Topics */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, marginBottom: 24 }}>
          <AnalyticsChart calls={calls} />

          {/* Top Topics */}
          <div className="card">
            <div className="drawer-section-title">Top Topics</div>
            {topTopics(calls).map((t, i) => (
              <div key={t.label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 14 }}>{i + 1}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, marginBottom: 5 }}>{t.label}</div>
                  <div style={{ height: 3, borderRadius: 99, background: 'var(--surface3)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 99, background: 'var(--purple)', width: `${t.pct}%` }} />
                  </div>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 36, textAlign: 'right' }}>
                  {t.pct}%
                </span>
              </div>
            ))}
            {calls.length === 0 && !loading && (
              <div className="empty-state" style={{ padding: 0, alignItems: 'flex-start' }}>No calls yet.</div>
            )}
          </div>
        </div>

        {/* Call table */}
        {loading ? (
          <div className="empty-state"><div className="spinner" /></div>
        ) : (
          <CallTable
            calls={calls}
            onSelect={setSelected}
            onDelete={handleDeleteCall}
            canDelete={isManager}
          />
        )}

      </main>

      {selected && (
        <CallDetail call={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────
function topTopics(calls) {
  const counts = {}
  calls.forEach(c => {
    counts[c.outcome] = (counts[c.outcome] || 0) + 1
  })
  const total = calls.length || 1
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, n]) => ({ label, pct: Math.round((n / total) * 100) }))
}