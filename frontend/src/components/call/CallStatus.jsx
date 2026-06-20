// src/components/call/CallStatus.jsx

const STATUS_TEXT = {
  connecting:   'Connecting...',
  idle:         'Connected',
  listening:    'Listening...',
  speaking:     'AI is speaking...',
  saving:       'Generating summary...',
  muted:        'Microphone muted',
  disconnected: 'Call ended',
}

export default function CallStatus({ status = 'idle' }) {
  return (
    <div className={`call-status-pill ${status}`}>
      <span className="dot" />
      {STATUS_TEXT[status] ?? status}
    </div>
  )
}
