// src/components/call/TranscriptPanel.jsx
import { useEffect, useRef } from 'react'
import { useCallStore } from '../../store/callStore'
import { Mic, AlignLeft } from 'lucide-react'

export default function TranscriptPanel() {
  const transcript = useCallStore(s => s.transcript)
  const bottomRef  = useRef(null)

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcript])

  return (
    <div className="transcript-panel">

      {/* Header */}
      <div className="transcript-header">
        <div className="flex items-center gap-2">
          <AlignLeft size={14} color="var(--text-muted)" />
          <h3>Live Transcript</h3>
        </div>
        <span style={{
          fontSize: 11, fontFamily: 'var(--mono)',
          color: 'var(--text-muted)',
          display: 'flex', alignItems: 'center', gap: 6
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--green)', display: 'inline-block'
          }} />
          Recording &amp; Transcribing...
        </span>
      </div>

      {/* Messages */}
      <div className="transcript-body">
        {transcript.length === 0 && (
          <div style={{
            textAlign: 'center', color: 'var(--text-muted)',
            fontSize: 13, marginTop: 40
          }}>
            Transcript will appear here once the call starts.
          </div>
        )}

        {transcript.map((msg, i) => (
          <div
            key={i}
            className={`transcript-msg ${msg.role === 'ai' ? 'ai' : ''}`}
          >
            {/* Avatar */}
            <div className="avatar">
              {msg.role === 'ai' ? <Mic size={10} /> : 'U'}
            </div>

            {/* Body */}
            <div className="transcript-msg-body">
              <div className="who">
                {msg.role === 'ai' ? 'AI Voice Agent' : 'You'}
                <span className="ts">{formatTime(msg.time)}</span>
              </div>
              <p>{msg.text}</p>
            </div>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Footer */}
      <div className="transcript-footer">
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: 'var(--purple)',
          display: 'inline-block',
          animation: 'blink 1.2s ease-in-out infinite'
        }} />
        AI is processing...
      </div>

    </div>
  )
}

// Helper — format timestamp as MM:SS
function formatTime(ts) {
  if (!ts) return '00:00'
  const d = new Date(ts)
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${mm}:${ss}`
}
