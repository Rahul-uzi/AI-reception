// src/pages/AnalyticsPage.jsx
import { useState, useEffect } from 'react'
import Sidebar from '../components/shared/Sidebar'
import { fetchAnalytics } from '../lib/api'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { TrendingUp, Phone, Clock, Star, ThumbsUp } from 'lucide-react'

const PIE_COLORS = ['#7c6dfa', '#22d37a', '#f04444', '#f5a623']

function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="stat-card" style={{ display:'flex', flexDirection:'column', gap:6 }}>
      <div className="label" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <span>{label}</span>
        <Icon size={14} style={{ color: color ?? 'var(--purple)' }} />
      </div>
      <div className="value">{value}</div>
      {sub && <div className="delta">{sub}</div>}
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 14px', fontSize:12 }}>
      <div style={{ color:'var(--text-muted)', marginBottom:6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, marginBottom:2 }}>{p.name}: <strong>{p.value}</strong></div>
      ))}
    </div>
  )
}

export default function AnalyticsPage() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [range,   setRange]   = useState('7d')

  async function load() {
    setLoading(true); setData(await fetchAnalytics()); setLoading(false)
  }
  useEffect(() => { load() }, [range])

  if (loading) return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-content"><div className="empty-state" style={{ height:'60vh' }}><div className="spinner"/></div></main>
    </div>
  )

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-content">
        <div className="page-header">
          <div>
            <h1 className="page-title">Analytics</h1>
            <p className="page-sub">Performance metrics for your AI Voice Agent</p>
          </div>
          <div className="filter-pills">
            {['7d','30d','90d'].map(r => (
              <button key={r} className={`filter-pill ${range===r?'active':''}`} onClick={() => setRange(r)}>{r}</button>
            ))}
          </div>
        </div>

        {/* KPI row */}
        <div className="stats-bar">
          <StatCard icon={Phone}     label="Total Calls"      value={data.totalCalls}        sub="↑ 12% vs last period" color="var(--purple)" />
          <StatCard icon={Clock}     label="Avg Duration"     value={data.avgDuration}       sub="Per call"             color="var(--amber)"  />
          <StatCard icon={ThumbsUp}  label="Resolution Rate"  value={`${data.resolutionRate}%`} sub="↑ 3% vs last period" color="var(--green)"  />
          <StatCard icon={Star}      label="Satisfaction"     value={`${data.satisfaction}%`}   sub="Based on sentiment"  color="var(--purple)" />
        </div>

        {/* Calls per day + Outcome breakdown */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:16, marginBottom:24 }}>
          <div className="card">
            <div style={{ fontWeight:600, fontSize:14, marginBottom:20 }}>Calls Per Day</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.byDay} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" tick={{ fontSize:11, fill:'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize:11, fill:'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="calls"    name="Total"    fill="var(--purple)" radius={[4,4,0,0]} />
                <Bar dataKey="resolved" name="Resolved" fill="var(--green)"  radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <div style={{ fontWeight:600, fontSize:14, marginBottom:20 }}>Outcome Breakdown</div>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={data.byOutcome} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3}>
                  {data.byOutcome.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:8 }}>
              {data.byOutcome.map((o, i) => (
                <div key={o.name} className="flex justify-between items-center" style={{ fontSize:12 }}>
                  <div className="flex items-center gap-2">
                    <div style={{ width:8, height:8, borderRadius:'50%', background: PIE_COLORS[i % PIE_COLORS.length], flexShrink:0 }} />
                    <span style={{ color:'var(--text-muted)' }}>{o.name}</span>
                  </div>
                  <span style={{ fontWeight:500 }}>{o.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Calls by hour */}
        <div className="card">
          <div style={{ fontWeight:600, fontSize:14, marginBottom:20 }}>Call Volume by Hour</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data.byHour}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="hour" tick={{ fontSize:11, fill:'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize:11, fill:'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="calls" name="Calls" stroke="var(--purple)" strokeWidth={2} dot={{ fill:'var(--purple)', r:3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </main>
    </div>
  )
}
