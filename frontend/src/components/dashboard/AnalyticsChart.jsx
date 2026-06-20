// src/components/dashboard/AnalyticsChart.jsx
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, BarChart, Bar, Cell, Legend
} from 'recharts'

function buildWeekData(calls) {
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  const counts = Object.fromEntries(days.map(d => [d, 0]))
  calls.forEach(c => {
    // Backend saves 'timestamp' (ISO string)
    const ts = c.timestamp || c.start_time
    if (!ts) return
    const safeTs = ts.includes('Z') || ts.includes('+') ? ts : ts.split('.')[0]
    const d = new Date(safeTs)
    if (isNaN(d.getTime())) return
    const day = days[d.getDay()]
    counts[day]++
  })
  // Rotate so today is last (most recent on right)
  const today = new Date().getDay()
  const ordered = [...days.slice(today + 1), ...days.slice(0, today + 1)]
  return ordered.map(day => ({ day, calls: counts[day] }))
}

function buildSentimentData(calls) {
  const counts = { positive: 0, neutral: 0, negative: 0 }
  calls.forEach(c => {
    const s = (c.sentiment || 'neutral').toLowerCase()
    if (s in counts) counts[s]++
  })
  return [
    { name: 'Positive', value: counts.positive, color: '#22c55e' },
    { name: 'Neutral',  value: counts.neutral,  color: '#a78bfa' },
    { name: 'Negative', value: counts.negative, color: '#f87171' },
  ]
}

const LineTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 14px', fontSize:12 }}>
      <div style={{ color:'var(--text-muted)', marginBottom:4 }}>{label}</div>
      <div style={{ color:'var(--purple)', fontWeight:600 }}>{payload[0].value} calls</div>
    </div>
  )
}

const BarTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 14px', fontSize:12 }}>
      <div style={{ color: payload[0].payload.color, fontWeight:600 }}>{payload[0].name}: {payload[0].value}</div>
    </div>
  )
}

export default function AnalyticsChart({ calls = [] }) {
  const weekData      = buildWeekData(calls)
  const sentimentData = buildSentimentData(calls)
  const totalSentiment = sentimentData.reduce((s, d) => s + d.value, 0) || 1

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      {/* Line Chart — Calls per day */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontWeight:600, fontSize:14 }}>Call Analytics</div>
          <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>Calls per day this week</div>
        </div>
        <div style={{ fontSize:11, color:'var(--text-muted)', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:6, padding:'4px 10px' }}>
          This Week
        </div>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={weekData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="day" tick={{ fill:'var(--text-muted)', fontSize:11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill:'var(--text-muted)', fontSize:11 }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
          <Tooltip content={<LineTooltip />} />
          <Line type="monotone" dataKey="calls" stroke="var(--purple)" strokeWidth={2}
            dot={{ fill:'var(--purple)', r:3, strokeWidth:0 }}
            activeDot={{ r:5, fill:'var(--purple)' }} />
        </LineChart>
      </ResponsiveContainer>

      {/* Divider */}
      <div style={{ borderTop:'1px solid var(--border)', margin:'20px 0' }} />

      {/* Sentiment Bar */}
      <div style={{ fontWeight:600, fontSize:13, marginBottom:14 }}>Sentiment Breakdown</div>
      {calls.length === 0 ? (
        <div style={{ fontSize:12, color:'var(--text-muted)' }}>No calls yet.</div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={90}>
            <BarChart data={sentimentData} layout="vertical" margin={{ left:0, right:0 }}>
              <XAxis type="number" hide allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fill:'var(--text-muted)', fontSize:11 }} axisLine={false} tickLine={false} width={58} />
              <Tooltip content={<BarTooltip />} />
              <Bar dataKey="value" radius={[0,4,4,0]}>
                {sentimentData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display:'flex', gap:16, marginTop:8 }}>
            {sentimentData.map(s => (
              <div key={s.name} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11 }}>
                <span style={{ width:8, height:8, borderRadius:'50%', background:s.color, display:'inline-block' }} />
                <span style={{ color:'var(--text-muted)' }}>{s.name}</span>
                <span style={{ fontWeight:600 }}>{Math.round((s.value / totalSentiment) * 100)}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
