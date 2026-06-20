// src/components/call/WaveformOrb.jsx
const BARS = 28

// status: 'idle' | 'listening' | 'speaking'
export default function WaveformOrb({ status = 'idle' }) {
  return (
    <div className={`orb-wrap orb--${status}`}>
      <div className="orb-ring" />
      <div className="orb-ring-2" />
      <div className="orb-glow" />
      <div className="orb-core">
        {Array.from({ length: BARS }).map((_, i) => (
          <span
            key={i}
            className="orb-bar"
            style={{ '--i': i, '--total': BARS }}
          />
        ))}
      </div>
    </div>
  )
}
