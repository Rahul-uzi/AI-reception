import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DemoOverlay from '../components/landing/DemoOverlay'
import {
  Phone, MessageSquare, BarChart2, Mic, Shield, Zap
} from 'lucide-react'

const TRUSTED = ['Acme', 'Globex', 'Initech', 'Umbrella', 'Stark']

export default function LandingPage() {
  const navigate = useNavigate()
  const [showDemo, setShowDemo] = useState(false)

  return (
    <div className="landing">

      {/* ── NAV ───────────────────────────────────────────── */}
      <nav className="landing-nav">
        <div className="flex items-center gap-2">
          <Mic size={18} color="var(--purple)" />
          <span style={{ fontWeight: 600, fontSize: 15 }}>AI Voice Agent</span>
        </div>
        <button
          className="btn-ghost"
          style={{ padding: '8px 18px', fontSize: 13 }}
          onClick={() => navigate('/dashboard')}
        >
          Sign In
        </button>
      </nav>

      {/* ── HERO ──────────────────────────────────────────── */}
      <div style={{ marginTop: 80, position: 'relative', zIndex: 1 }}>
        <div className="landing-tag">
          <span className="dot" />
          24/7 AI Voice Assistant
        </div>

        <h1 className="hero-title">
          Your AI Voice Agent<br />
          <span className="accent glow-text">Always Answers.</span>
        </h1>

        <p className="sub">
          Let our AI handle calls, qualify leads, answer questions
          and collect important information for you.
        </p>

        <div className="landing-btns">
          <button className="btn-primary" onClick={() => navigate('/call')}>Book a Demo</button>
          <button className="btn-ghost" onClick={() => setShowDemo(true)}>See How It Works</button>
        </div>

        {/* Features */}
        <div className="landing-features">
          <div className="feature-pill"><MessageSquare size={14} /> Human-like Conversations</div>
          <div className="feature-pill"><BarChart2 size={14} /> Collects & Qualifies Data</div>
          <div className="feature-pill"><Phone size={14} /> Real-time Transcripts</div>
        </div>
      </div>

      {/* Demo Overlay */}
      {showDemo && <DemoOverlay onClose={() => setShowDemo(false)} />}

      {/* ── TRUSTED BY ────────────────────────────────────── */}
      <div style={{ marginTop: 80, width: '100%', maxWidth: 600 }}>
        <p className="drawer-section-title" style={{ textAlign: 'center', marginBottom: 24 }}>Trusted by businesses of all sizes</p>
        <div className="flex items-center justify-between" style={{ opacity: 0.5 }}>
          {TRUSTED.map(name => (
            <span key={name} style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.3px', color: 'var(--text-muted)' }}>{name}</span>
          ))}
        </div>
      </div>

      {/* ── HOW IT WORKS ──────────────────────────────────── */}
      <div style={{ marginTop: 100, width: '100%', maxWidth: 900 }}>
        <h2 style={{ fontSize: 32, fontWeight: 700, marginBottom: 12, letterSpacing: '-1px' }}>How it works</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 16, marginBottom: 48 }}>Three steps from call to insight</p>

        <div className="contacts-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {STEPS.map((s, i) => (
            <div key={i} className="card" style={{ textAlign: 'left', padding: '32px 24px' }}>
              <div className="sidebar-logo-icon" style={{ width: 40, height: 40, marginBottom: 20 }}>
                <s.icon size={18} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--purple)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>Step {i + 1}</div>
              <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 18 }}>{s.title}</div>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── BOTTOM CTA ────────────────────────────────────── */}
      <div style={{
        marginTop: 120, marginBottom: 80,
        background: 'linear-gradient(135deg, var(--surface) 0%, var(--surface2) 100%)',
        border: '1px solid var(--border-md)',
        borderRadius: 'var(--radius-lg)', padding: '64px 40px',
        width: '100%', maxWidth: 700, textAlign: 'center',
        boxShadow: 'var(--shadow-purple)'
      }}>
        <div style={{ fontSize: 12, color: 'var(--purple)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 16 }}>Get Started Free</div>
        <h2 style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-1px', marginBottom: 16 }}>Ready to automate your calls?</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 16, marginBottom: 32 }}>Set up in minutes. No credit card required.</p>
        <button className="btn-primary" style={{ padding: '16px 48px', fontSize: 16, fontWeight: 600 }} onClick={() => navigate('/call')}>Try It Now →</button>
      </div>

    </div>
  )
}

// ── DATA ──────────────────────────────────────────────────────
const STEPS = [
  {
    icon: Phone,
    title: 'Bot Calls the User',
    desc: 'Your AI Voice Agent initiates or receives calls automatically, 24/7 without any manual effort.',
  },
  {
    icon: Mic,
    title: 'Live Conversation',
    desc: 'Natural voice conversation with real-time transcription. The AI qualifies leads and collects data.',
  },
  {
    icon: BarChart2,
    title: 'Summary & Insights',
    desc: 'Every call is summarised with intent, sentiment, and extracted data — ready on your dashboard.',
  },
]
