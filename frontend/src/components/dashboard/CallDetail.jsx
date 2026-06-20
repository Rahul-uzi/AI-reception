// src/components/dashboard/CallDetail.jsx
import { useState } from 'react'
import { X, Mic, User } from 'lucide-react'
import Badge from '../shared/Badge'

const TABS = ['Overview', 'Transcript', 'Analysis']

function formatTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  })
}

export default function CallDetail({ call, onClose }) {
  const [tab, setTab] = useState('Transcript')
  if (!call) return null

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 700, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div className="modal-header" style={{ flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>Call with {call.phone}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
              {new Date(call.timestamp).toLocaleString()} · {call.duration}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="green">{call.status || 'Completed'}</Badge>
            <button className="icon-close" onClick={onClose}><X size={15} /></button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 24px', flexShrink: 0 }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '12px 16px', fontSize: 13, fontFamily: 'var(--font)',
              color: tab === t ? 'var(--text)' : 'var(--text-muted)',
              borderBottom: tab === t ? '2px solid var(--purple)' : '2px solid transparent',
              marginBottom: -1, transition: 'color 0.15s'
            }}>{t}</button>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          {tab === 'Overview'    && <OverviewTab  call={call} />}
          {tab === 'Transcript'  && <TranscriptTab transcript={call.transcript} />}
          {tab === 'Analysis'    && <AnalysisTab  call={call} />}
        </div>

      </div>
    </div>
  )
}

function OverviewTab({ call }) {
  const transcriptArr = Array.isArray(call.transcript) ? call.transcript : []
  const userMessages = transcriptArr.filter(m => m.role === 'user').length
  const aiMessages   = transcriptArr.filter(m => m.role === 'ai' || m.role === 'assistant').length

  const rows = [
    ['Phone',       call.phone],
    ['Duration',    call.duration],
    ['Status',      call.status || 'Completed'],
    ['Outcome',     call.outcome],
    ['User turns',  userMessages],
    ['AI turns',    aiMessages],
    ['Time',        new Date(call.timestamp).toLocaleString()],
  ]

  return (
    <div>
      <div className="drawer-section-title">AI Summary</div>
      <div style={{
        background: 'var(--surface2)', borderRadius: 'var(--radius)',
        padding: 16, fontSize: 13, lineHeight: 1.6, marginBottom: 20,
        border: '1px solid var(--border)', borderLeft: '3px solid var(--purple)'
      }}>
        {call.summary || "No summary available."}
      </div>

      <div className="drawer-section-title">Details</div>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
          <span style={{ color: 'var(--text-muted)' }}>{k}</span>
          <span style={{ fontWeight: 500 }}>{v}</span>
        </div>
      ))}
    </div>
  )
}

function TranscriptTab({ transcript }) {
  const transcriptArr = Array.isArray(transcript) ? transcript : []

  if (!transcriptArr.length) {
    return <div className="empty-state" style={{ padding: 40 }}>No transcript available.</div>
  }

  return (
    <div className="flex flex-col gap-4">
      {transcriptArr.map((msg, i) => {
        const isAI = msg.role === 'ai' || msg.role === 'assistant'
        const text = msg.text || msg.content
        const time = msg.time || msg.timestamp
        return (
          <div key={i} className="flex gap-3 items-start">
            <div className={`avatar-md`} style={{ width: 30, height: 30, fontSize: 10 }}>
              {isAI ? <Mic size={11} /> : <User size={11} />}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 600 }}>{isAI ? 'AI Voice Agent' : 'Caller'}</span>
                {time && <span style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>{formatTime(time)}</span>}
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.6, color: isAI ? 'var(--text)' : 'var(--text-muted)' }}>{text}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function AnalysisTab({ call }) {
  const items = [
    ['Sentiment',  call.sentiment || 'Neutral'],
    ['Outcome',    call.outcome || 'Unknown'],
    ['Agent',      'Pipecat + VoiceSummary'],
  ]

  return (
    <div>
      <div className="drawer-section-title">Action Items</div>
      <div className="flex flex-col gap-2 mb-6">
        {call.actions && call.actions.length > 0 ? (
          call.actions.map((action, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              fontSize: 13, padding: '10px 14px', background: 'var(--surface2)',
              borderRadius: 8, border: '1px solid var(--border)'
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--purple)' }} />
              {action}
            </div>
          ))
        ) : (
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No actions detected.</div>
        )}
      </div>

      <div className="drawer-section-title">Metadata</div>
      {items.map(([k, v]) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
          <span style={{ color: 'var(--text-muted)' }}>{k}</span>
          <span style={{
            fontWeight: 500,
            color: k === 'Sentiment' && v.toLowerCase() === 'positive' ? 'var(--green)'
              : k === 'Sentiment' && v.toLowerCase() === 'negative' ? 'var(--red)'
              : 'var(--text)'
          }}>{v}</span>
        </div>
      ))}
    </div>
  )
}
