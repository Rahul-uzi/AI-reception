// src/components/dashboard/StatsBar.jsx
import { Phone, PhoneIncoming, Clock, TrendingUp } from 'lucide-react'

function avgDuration(calls) {
  if (!calls.length) return '00:00'
  const total = calls.reduce((sum, c) => {
    const [mm, ss] = (c.duration || '0:00').split(':').map(Number)
    return sum + (mm * 60 + ss)
  }, 0)
  const avg = Math.round(total / calls.length)
  return `${String(Math.floor(avg / 60)).padStart(2, '0')}:${String(avg % 60).padStart(2, '0')}`
}

function resolutionRate(calls) {
  if (!calls.length) return '0%'
  const resolved = calls.filter(c => {
    const out = (c.outcome || '').toLowerCase()
    return out.includes('booked') || out.includes('provided') || out.includes('resolved')
  }).length
  return `${Math.round((resolved / calls.length) * 100)}%`
}

function todayCount(calls) {
  const todayStr = new Date().toISOString().slice(0, 10)
  return calls.filter(c => (c.timestamp || '').startsWith(todayStr)).length
}

function sentimentDelta(calls) {
  if (!calls.length) return 'No calls yet'
  const pos = calls.filter(c => (c.sentiment || '').toLowerCase() === 'positive').length
  const pct = Math.round((pos / calls.length) * 100)
  return `${pct}% positive sentiment`
}

export default function StatsBar({ calls = [] }) {
  const today = todayCount(calls)
  const stats = [
    {
      label: 'Total Calls',
      value: String(calls.length),
      icon: Phone,
      delta: today > 0 ? `+${today} today` : 'No calls today',
      color: 'var(--purple)'
    },
    {
      label: 'Answered Calls',
      value: String(calls.filter(c => c.status === 'Completed').length),
      icon: PhoneIncoming,
      delta: `${resolutionRate(calls)} completion rate`,
      color: 'var(--green)'
    },
    {
      label: 'Avg. Call Duration',
      value: avgDuration(calls),
      icon: Clock,
      delta: `across ${calls.length} call${calls.length !== 1 ? 's' : ''}`,
      color: 'var(--blue, #60a5fa)'
    },
    {
      label: 'Resolution Rate',
      value: resolutionRate(calls),
      icon: TrendingUp,
      delta: sentimentDelta(calls),
      color: 'var(--green)'
    },
  ]

  return (
    <div className="stats-bar">
      {stats.map(s => (
        <div key={s.label} className="stat-card">
          <div className="label">
            {s.label}
            <s.icon size={14} color="var(--text-muted)" />
          </div>
          <div className="value" style={{ color: s.color }}>{s.value}</div>
          <div className="delta">↑ {s.delta}</div>
        </div>
      ))}
    </div>
  )
}
