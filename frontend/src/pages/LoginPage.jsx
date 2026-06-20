// src/pages/LoginPage.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { Phone, Eye, EyeOff, Loader } from 'lucide-react'

export default function LoginPage() {
  const navigate   = useNavigate()
  const login      = useAuthStore(s => s.login)
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const demoAccounts = [
    { role: 'Admin',   email: 'admin@demo.com',   password: 'admin123',   color: '#a78bfa' },
    { role: 'Manager', email: 'manager@demo.com',  password: 'manager123', color: '#60a5fa' },
    { role: 'Viewer',  email: 'viewer@demo.com',   password: 'viewer123',  color: '#34d399' },
  ]

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      padding: 20,
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'linear-gradient(135deg, var(--purple), #818cf8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', boxShadow: '0 8px 24px rgba(139,92,246,0.3)'
          }}>
            <Phone size={24} color="white" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>
            AI Voice Agent
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
            Sign in to your account
          </p>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: 28 }}>
          <form onSubmit={handleSubmit}>

            {/* Email */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                Email
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                style={{
                  width: '100%', padding: '10px 14px', fontSize: 13,
                  border: '1px solid var(--border)', borderRadius: 8,
                  background: 'var(--surface2)', color: 'var(--text)',
                  outline: 'none', boxSizing: 'border-box',
                  fontFamily: 'var(--font)',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--purple)'}
                onBlur={e  => e.target.style.borderColor = 'var(--border)'}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="login-password"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{
                    width: '100%', padding: '10px 40px 10px 14px', fontSize: 13,
                    border: '1px solid var(--border)', borderRadius: 8,
                    background: 'var(--surface2)', color: 'var(--text)',
                    outline: 'none', boxSizing: 'border-box',
                    fontFamily: 'var(--font)',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={e => e.target.style.borderColor = 'var(--purple)'}
                  onBlur={e  => e.target.style.borderColor = 'var(--border)'}
                />
                <button type="button" onClick={() => setShowPw(v => !v)} style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', padding: 0, display: 'flex',
                }}>
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#f87171',
                marginBottom: 16
              }}>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', height: 40, fontSize: 14 }}
            >
              {loading ? <Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> : 'Sign In'}
            </button>
          </form>
        </div>

        {/* Demo Accounts */}
        <div className="card" style={{ padding: 20, marginTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
            Demo Accounts
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {demoAccounts.map(a => (
              <button key={a.role} type="button"
                onClick={() => { setEmail(a.email); setPassword(a.password) }}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 12px', borderRadius: 8,
                  background: 'var(--surface2)', border: '1px solid var(--border)',
                  cursor: 'pointer', fontSize: 12, color: 'var(--text)',
                  fontFamily: 'var(--font)', transition: 'border-color 0.15s',
                }}
                onMouseOver={e => e.currentTarget.style.borderColor = a.color}
                onMouseOut={e  => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%', background: a.color, display: 'inline-block'
                  }} />
                  <span style={{ fontWeight: 600 }}>{a.role}</span>
                  <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>{a.email}</span>
                </div>
                <span style={{ color: 'var(--text-muted)' }}>Click to fill →</span>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
