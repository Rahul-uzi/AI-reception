// src/pages/CallsPage.jsx
import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/shared/Sidebar'
import Badge from '../components/shared/Badge'
import { useAuthStore } from '../store/authStore'
import { fetchCalls, deleteCall } from '../lib/api'
import {
  Phone, Search, Filter, Download, RefreshCw,
  Clock, ChevronRight, X, Mic, TrendingUp,
  PhoneIncoming, PhoneOff, PhoneMissed, Trash2
} from 'lucide-react'

const OUTCOME_BADGE = {
  'Appointment Booked': 'green',
  'Info Provided':      'purple',
  'Escalated':          'red',
  'Voicemail':          'amber',
}

function relativeTime(ts) {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function CallsPage() {
  const navigate = useNavigate()
  const [calls,    setCalls]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [filter,   setFilter]   = useState('all')
  const [selected, setSelected] = useState(null)
  const isManager = useAuthStore(s => s.isManager())

  async function load() {
    setLoading(true)
    setCalls(await fetchCalls())
    setLoading(false)
  }

  async function handleDelete(id) {
    if (!confirm('Permanently delete this call record?')) return
    try {
      await deleteCall(id)
      setSelected(null)
      load()
    } catch (err) {
      alert(`Delete failed: ${err.message}`)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    let list = calls
    if (filter !== 'all') list = list.filter(c => c.outcome === filter)
    if (search.trim())    list = list.filter(c =>
      c.phone.includes(search) ||
      c.outcome.toLowerCase().includes(search.toLowerCase()) ||
      (c.summary ?? '').toLowerCase().includes(search.toLowerCase())
    )
    return list
  }, [calls, filter, search])

  const outcomes = ['all', ...new Set(calls.map(c => c.outcome))]

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-content">

        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Calls</h1>
            <p className="page-sub">Full history of all AI-handled calls</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-ghost icon-btn" onClick={load}>
              <RefreshCw size={14} /> Refresh
            </button>
            <button className="btn-ghost icon-btn">
              <Download size={14} /> Export
            </button>
            <button className="btn-primary icon-btn" onClick={() => navigate('/call')}>
              <Phone size={14} /> New Call
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="toolbar">
          <div className="search-box">
            <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              placeholder="Search by number, outcome, summary…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ background: 'none', color: 'var(--text-muted)', padding: 0 }}>
                <X size={14} />
              </button>
            )}
          </div>
          <div className="filter-pills">
            {outcomes.map(o => (
              <button
                key={o}
                className={`filter-pill ${filter === o ? 'active' : ''}`}
                onClick={() => setFilter(o)}
              >
                {o === 'all' ? 'All calls' : o}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="calls-section">
          <div className="calls-section-header">
            <span>{filtered.length} calls</span>
          </div>
          {loading ? (
            <div className="empty-state"><div className="spinner" /></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <PhoneMissed size={32} style={{ color: 'var(--text-dim)', marginBottom: 12 }} />
              <p>No calls match your filter</p>
            </div>
          ) : (
            <table className="calls-table">
              <thead>
                <tr>
                  <th>Phone</th>
                  <th>Outcome</th>
                  <th>Duration</th>
                  <th>Sentiment</th>
                  <th>Time</th>
                  {isManager && <th></th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(call => (
                  <tr key={call.id} onClick={() => setSelected(call)} style={{ cursor: 'pointer' }}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="call-icon-sm"><PhoneIncoming size={12} /></div>
                        <span className="phone">{call.phone}</span>
                      </div>
                    </td>
                    <td><Badge variant={OUTCOME_BADGE[call.outcome] ?? 'muted'}>{call.outcome}</Badge></td>
                    <td>
                      <div className="flex items-center gap-1" style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                        <Clock size={12} /> {call.duration}
                      </div>
                    </td>
                    <td>
                      <SentimentDot s={call.sentiment} />
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{relativeTime(call.timestamp)}</td>
                    <td>
                      <div className="flex gap-2">
                        {isManager && (
                          <button 
                            className="btn-ghost icon-btn" 
                            onClick={(e) => { e.stopPropagation(); handleDelete(call.id); }}
                            style={{ color: 'var(--text-dim)' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                        <ChevronRight size={14} style={{ color: 'var(--text-dim)' }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* Call Detail Drawer */}
      {selected && (
        <CallDrawer call={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}

function SentimentDot({ s }) {
  const map = {
    positive: { color: 'var(--green)',  label: 'Positive' },
    neutral:  { color: 'var(--amber)',  label: 'Neutral'  },
    negative: { color: 'var(--red)',    label: 'Negative' },
  }
  const info = map[s] ?? map.neutral
  return (
    <div className="flex items-center gap-2" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: info.color, flexShrink: 0 }} />
      {info.label}
    </div>
  )
}

function CallDrawer({ call, onClose }) {
  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <aside className="drawer">
        <div className="drawer-header">
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 2 }}>{call.phone}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{relativeTime(call.timestamp)}</div>
          </div>
          <button className="icon-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="drawer-body">
          {/* Stats row */}
          <div className="drawer-stats">
            <div className="drawer-stat">
              <Clock size={14} style={{ color: 'var(--purple)' }} />
              <div>
                <div className="drawer-stat-val">{call.duration}</div>
                <div className="drawer-stat-lbl">Duration</div>
              </div>
            </div>
            <div className="drawer-stat">
              <TrendingUp size={14} style={{ color: 'var(--green)' }} />
              <div>
                <div className="drawer-stat-val" style={{ textTransform: 'capitalize' }}>{call.sentiment}</div>
                <div className="drawer-stat-lbl">Sentiment</div>
              </div>
            </div>
            <div className="drawer-stat">
              <Mic size={14} style={{ color: 'var(--amber)' }} />
              <div>
                <div className="drawer-stat-val"><Badge variant={OUTCOME_BADGE[call.outcome] ?? 'muted'}>{call.outcome}</Badge></div>
                <div className="drawer-stat-lbl">Outcome</div>
              </div>
            </div>
          </div>

          {/* Summary */}
          {call.summary && (
            <div className="drawer-section">
              <div className="drawer-section-title">AI Summary</div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>{call.summary}</p>
            </div>
          )}

          {/* Transcript */}
          {call.transcript && (
            <div className="drawer-section">
              <div className="drawer-section-title">Transcript Snippet</div>
              <div className="transcript-snippet">{call.transcript}</div>
            </div>
          )}

          {isManager && (
            <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--surface3)' }}>
              <button 
                className="btn-ghost" 
                onClick={() => handleDelete(call.id)}
                style={{ color: 'var(--red)', width: '100%', justifyContent: 'center' }}
              >
                <Trash2 size={14} style={{ marginRight: 8 }} />
                Delete Call Record
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
