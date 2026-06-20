import { useState, useEffect } from 'react'
import { X, Mic, Phone, User, MessageSquare } from 'lucide-react'

const SCRIPT = [
  { who: 'ai', text: 'Hello! This is Dr. Smith’s AI Receptionist. How can I help you today?', delay: 1000 },
  { who: 'user', text: 'Hi, I need to book a dental checkup for next week.', delay: 2000 },
  { who: 'ai', text: 'Of course! I have openings on Tuesday at 10:00 AM or Wednesday at 3:00 PM. Would either of those work?', delay: 2500 },
  { who: 'user', text: 'Tuesday at 10 AM works for me.', delay: 1800 },
  { who: 'ai', text: 'Perfect. I have scheduled your checkup for Tuesday at 10:00 AM. I’ve also sent a confirmation to your phone. Anything else?', delay: 2200 },
  { who: 'user', text: 'That’s all, thank you!', delay: 1200 },
  { who: 'ai', text: 'You’re welcome! Have a great day. Goodbye.', delay: 1500 },
]

export default function DemoOverlay({ onClose }) {
  const [messages, setMessages] = useState([])
  const [index, setIndex] = useState(0)
  const [typing, setTyping] = useState(false)

  useEffect(() => {
    if (index < SCRIPT.length) {
      const next = SCRIPT[index]
      setTyping(true)
      
      const timer = setTimeout(() => {
        setTyping(false)
        setMessages(prev => [...prev, next])
        setIndex(i => i + 1)
      }, next.delay)
      
      return () => clearTimeout(timer)
    }
  }, [index])

  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div className="modal" style={{ maxWidth: 400, height: '80vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
        {/* Header */}
        <div className="modal-header" style={{ background: 'var(--surface2)', padding: '16px 20px' }}>
          <div className="flex items-center gap-3">
            <div className="sidebar-logo-icon" style={{ width: 32, height: 32 }}>
              <Mic size={14} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Live AI Demo</div>
              <div style={{ fontSize: 11, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <div className="dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
                Active Simulation
              </div>
            </div>
          </div>
          <button className="icon-close" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16, background: 'var(--bg)' }}>
          {messages.map((m, i) => (
            <div key={i} style={{ 
              alignSelf: m.who === 'ai' ? 'flex-start' : 'flex-end',
              maxWidth: '85%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: m.who === 'ai' ? 'flex-start' : 'flex-end',
              gap: 4
            }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                {m.who === 'ai' ? <Mic size={10} /> : <User size={10} />}
                {m.who === 'ai' ? 'AI Assistant' : 'Patient'}
              </div>
              <div style={{ 
                padding: '10px 14px', 
                borderRadius: m.who === 'ai' ? '0 16px 16px 16px' : '16px 16px 0 16px',
                background: m.who === 'ai' ? 'var(--surface2)' : 'var(--purple)',
                color: m.who === 'ai' ? 'var(--text)' : 'white',
                fontSize: 13,
                lineHeight: 1.5,
                boxShadow: 'var(--shadow)'
              }}>
                {m.text}
              </div>
            </div>
          ))}
          
          {typing && (
            <div style={{ alignSelf: 'flex-start', padding: '10px 14px', background: 'var(--surface2)', borderRadius: '0 16px 16px 16px', display: 'flex', gap: 4 }}>
              <div className="dot-typing" />
              <div className="dot-typing" style={{ animationDelay: '0.2s' }} />
              <div className="dot-typing" style={{ animationDelay: '0.4s' }} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: 20, borderTop: '1px solid var(--border)', textAlign: 'center', background: 'var(--surface)' }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>This is an automated demonstration of the AI voice conversation capabilities.</p>
          <button className="btn-primary" style={{ width: '100%' }} onClick={onClose}>Finish Demo</button>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .dot-typing {
          width: 4px; height: 4px; border-radius: 50%;
          background: var(--text-muted);
          animation: dot-pulse 1.4s infinite;
        }
        @keyframes dot-pulse {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.4); opacity: 1; }
        }
      `}} />
    </div>
  )
}
