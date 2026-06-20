// src/pages/SettingsPage.jsx
import { useState, useEffect } from 'react'
import Sidebar from '../components/shared/Sidebar'
import { fetchSettings, saveSettings } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import { useToast } from '../components/shared/Toast'
import { Settings, User, Mic, Bell, Link2, Save, Check, AlertTriangle } from 'lucide-react'

const TABS = [
  { id: 'profile',       label: 'Profile',       icon: User   },
  { id: 'receptionist',  label: 'AI Voice Agent',icon: Mic    },
  { id: 'notifications', label: 'Notifications',  icon: Bell   },
  { id: 'integration',   label: 'Integrations',   icon: Link2  },
]

export default function SettingsPage() {
  const { addToast } = useToast()
  const user = useAuthStore(s => s.user)
  const updateProfile = useAuthStore(s => s.updateProfile)
  const [settings, setSettings] = useState(null)
  const [tab,      setTab]      = useState('profile')
  const [saved,    setSaved]    = useState(false)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    fetchSettings().then(s => { setSettings(s); setLoading(false) })
  }, [])

  function update(section, key, value) {
    setSettings(prev => ({ ...prev, [section]: { ...prev[section], [key]: value } }))
  }

  async function handleSave() {
    try {
      if (tab === 'profile') {
        const p = settings.profile
        const isDowngrade = user.role === 'admin' && p.role.toLowerCase() !== 'admin'
        if (isDowngrade && !confirm("Warning: You are changing your OWN role. You will lose Admin access and won't be able to undo this yourself. Continue?")) {
          return
        }
        await updateProfile({
          name: p.name,
          email: p.email,
          role: p.role.toLowerCase(),
          password: p.password
        })
      } else {
        await saveSettings(settings)
      }
      setSaved(true)
      addToast('Settings saved successfully', 'success')
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      addToast(err.message, 'error')
    }
  }

  if (loading) return (
    <div className="app-shell"><Sidebar />
      <main className="app-content"><div className="empty-state" style={{ height:'60vh' }}><div className="spinner"/></div></main>
    </div>
  )

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-content">
        <div className="page-header">
          <div>
            <h1 className="page-title">Settings</h1>
            <p className="page-sub">Configure your AI Voice Agent</p>
          </div>
          <button className="btn-primary icon-btn" onClick={handleSave}>
            {saved ? <><Check size={14}/> Saved!</> : <><Save size={14}/> Save Changes</>}
          </button>
        </div>

        <div className="settings-layout">
          {/* Sidebar tabs */}
          <nav className="settings-nav">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={`settings-nav-item ${tab === id ? 'active' : ''}`}
                onClick={() => setTab(id)}
              >
                <Icon size={15} /> {label}
              </button>
            ))}
          </nav>

          {/* Panel */}
          <div className="settings-panel">
            {tab === 'profile' && <ProfileTab s={settings.profile} update={(k,v) => update('profile',k,v)} />}
            {tab === 'receptionist' && <ReceptionistTab s={settings.receptionist} update={(k,v) => update('receptionist',k,v)} />}
            {tab === 'notifications' && <NotificationsTab s={settings.notifications} update={(k,v) => update('notifications',k,v)} />}
            {tab === 'integration' && <IntegrationTab s={settings.integration} update={(k,v) => update('integration',k,v)} />}
          </div>
        </div>
      </main>
    </div>
  )
}

function Section({ title, desc, children }) {
  return (
    <div className="settings-section">
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{title}</div>
        {desc && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{desc}</div>}
      </div>
      {children}
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div className="settings-field">
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{hint}</div>}
      </div>
      <div style={{ flex: 1, maxWidth: 400 }}>{children}</div>
    </div>
  )
}

function Toggle({ checked, onChange }) {
  return (
    <div className={`toggle ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}>
      <div className="toggle-thumb" />
    </div>
  )
}

function ProfileTab({ s, update }) {
  const user = useAuthStore(s => s.user)
  const isDowngrading = user.role === 'admin' && s.role.toLowerCase() !== 'admin'

  return (
    <Section title="Profile" desc="Your account information">
      <Field label="Name"><input className="form-input" value={s.name} onChange={e => update('name', e.target.value)} /></Field>
      <Field label="Email"><input className="form-input" type="email" value={s.email} onChange={e => update('email', e.target.value)} /></Field>
      <Field label="Role">
        <select className="form-input" value={s.role} onChange={e => update('role', e.target.value)}>
          {['Admin','Manager','Viewer'].map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        {isDowngrading && (
          <div style={{ 
            marginTop: 12, padding: '10px 12px', borderRadius: 8, 
            background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)',
            display: 'flex', alignItems: 'center', gap: 10, color: '#d97706', fontSize: 12
          }}>
            <AlertTriangle size={16} />
            <div>
              <strong>Role Downgrade:</strong> If you save this, you will lose Admin access immediately. 
              Only another Admin can restore your role from the User Management page.
            </div>
          </div>
        )}
      </Field>
      <Field label="Password" hint="Leave blank to keep current">
        <input className="form-input" type="password" placeholder="••••••••" onChange={e => update('password', e.target.value)} />
      </Field>
    </Section>
  )
}

function ReceptionistTab({ s, update }) {
  return (
    <Section title="AI Voice Agent" desc="Customize how your AI Voice Agent behaves">
      <Field label="Receptionist Name" hint="Name the AI introduces itself with">
        <input className="form-input" value={s.name} onChange={e => update('name', e.target.value)} />
      </Field>
      <Field label="Greeting Message" hint="First words the AI speaks on each call">
        <textarea className="form-input" value={s.greeting} onChange={e => update('greeting', e.target.value)} rows={4} style={{ resize:'vertical' }} />
      </Field>
      <Field label="Language">
        <select className="form-input" value={s.language} onChange={e => update('language', e.target.value)}>
          {['en-US','en-GB','es-ES','fr-FR','de-DE','hi-IN'].map(l => <option key={l}>{l}</option>)}
        </select>
      </Field>
      <Field label={`Voice Speed — ${s.voiceSpeed}×`} hint="How fast the AI speaks">
        <input type="range" min="0.5" max="2" step="0.1" value={s.voiceSpeed}
          onChange={e => update('voiceSpeed', parseFloat(e.target.value))}
          style={{ width:'100%', accentColor:'var(--purple)' }} />
      </Field>
      <Field label={`Voice Pitch — ${s.voicePitch}×`} hint="Pitch of the AI voice">
        <input type="range" min="0.5" max="2" step="0.1" value={s.voicePitch}
          onChange={e => update('voicePitch', parseFloat(e.target.value))}
          style={{ width:'100%', accentColor:'var(--purple)' }} />
      </Field>
    </Section>
  )
}

function NotificationsTab({ s, update }) {
  const items = [
    { key:'email',       label:'Email Notifications',   hint:'Receive call summaries via email' },
    { key:'sms',         label:'SMS Alerts',            hint:'Get urgent alerts via SMS' },
    { key:'callSummary', label:'Call Summary Reports',  hint:'Daily digest of all calls' },
    { key:'escalation',  label:'Escalation Alerts',     hint:'Notify when a call is escalated' },
  ]
  return (
    <Section title="Notifications" desc="Choose how you want to be notified">
      {items.map(({ key, label, hint }) => (
        <div key={key} className="settings-field">
          <div>
            <div style={{ fontSize:13, fontWeight:500, marginBottom:2 }}>{label}</div>
            <div style={{ fontSize:11, color:'var(--text-muted)' }}>{hint}</div>
          </div>
          <Toggle checked={s[key]} onChange={v => update(key, v)} />
        </div>
      ))}
    </Section>
  )
}

function IntegrationTab({ s, update }) {
  return (
    <Section title="Integrations" desc="Connect external services">
      <Field label="Webhook URL" hint="POST call summaries to this endpoint">
        <input className="form-input" value={s.webhookUrl} onChange={e => update('webhookUrl', e.target.value)} placeholder="https://your-server.com/webhook" />
      </Field>
      <Field label="API Key" hint="For authenticating webhook requests">
        <input className="form-input" value={s.apiKey} onChange={e => update('apiKey', e.target.value)} placeholder="sk-…" type="password" />
      </Field>
      <div style={{ padding:'16px', borderRadius:'var(--radius)', background:'var(--surface2)', border:'1px solid var(--border)', marginTop:8 }}>
        <div style={{ fontSize:13, fontWeight:500, marginBottom:4, color:'var(--text-muted)' }}>Backend Status</div>
        <div className="flex items-center gap-2">
          <div style={{ width:7, height:7, borderRadius:'50%', background:'var(--green)' }} />
          <span style={{ fontSize:12, color:'var(--green)' }}>Backend connected and running</span>
        </div>
      </div>
    </Section>
  )
}
