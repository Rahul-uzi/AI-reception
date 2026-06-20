// src/components/shared/Sidebar.jsx
import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Mic, LayoutDashboard, Phone, Users,
  BookOpen, BarChart2, Settings, ChevronUp,
  LogOut, UserCircle, Sun, Moon, Menu, X as CloseIcon, Shield
} from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'
import { useAuthStore } from '../../store/authStore'

const ROLE_BADGE = {
  admin:   { label: 'Admin',   color: '#a78bfa' },
  manager: { label: 'Manager', color: '#60a5fa' },
  viewer:  { label: 'Viewer',  color: '#34d399' },
}

const NAV = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { label: 'Calls',     icon: Phone,           path: '/calls'     },
  { label: 'Contacts',  icon: Users,           path: '/contacts'  },
  { label: 'Knowledge', icon: BookOpen,        path: '/knowledge' },
  { label: 'Analytics', icon: BarChart2,       path: '/analytics' },
  { label: 'Settings',  icon: Settings,        path: '/settings', minRole: 'admin' },
  { label: 'Users',     icon: Shield,          path: '/users',    minRole: 'admin' },
]

function hasRole(userRole, minRole) {
  const hierarchy = { admin: 3, manager: 2, viewer: 1 }
  return (hierarchy[userRole] ?? 0) >= (hierarchy[minRole] ?? 0)
}

export default function Sidebar() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { theme, toggleTheme } = useTheme()
  const user   = useAuthStore(s => s.user)
  const logout = useAuthStore(s => s.logout)
  const [profileOpen,    setProfileOpen]    = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const profileRef = useRef(null)

  useEffect(() => {
    function handler(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'
  const badge = ROLE_BADGE[user?.role] ?? { label: user?.role ?? '', color: '#6b7280' }

  function handleLogout() {
    logout()
    navigate('/login')
  }

  // Filter nav by role
  const visibleNav = NAV.filter(item => !item.minRole || hasRole(user?.role, item.minRole))

  return (
    <>
      {/* Mobile Toggle */}
      <div className="mobile-only" style={{ position: 'fixed', top: 12, left: 12, zIndex: 2000 }}>
        <button className="btn-ghost" style={{ padding: 8, background: 'var(--surface2)' }} onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <CloseIcon size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <aside className={`sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon"><Mic size={16} /></div>
          AI Voice Agent
        </div>

        {/* Nav items */}
        <nav className="sidebar-nav">
          {visibleNav.map(({ label, icon: Icon, path }) => {
            const active = location.pathname === path
            return (
              <button
                key={path}
                className={`sidebar-nav-item ${active ? 'active' : ''}`}
                onClick={() => { navigate(path); setMobileMenuOpen(false) }}
              >
                <Icon size={15} />
                {label}
                {active && <div className="nav-active-bar" />}
              </button>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <button className="sidebar-nav-item" onClick={toggleTheme} style={{ marginBottom: 8 }}>
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>

          <div ref={profileRef} style={{ position: 'relative' }}>
            <div
              className={`profile-btn ${profileOpen ? 'open' : ''}`}
              onClick={() => setProfileOpen(o => !o)}
              role="button" tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && setProfileOpen(o => !o)}
            >
              <div className="profile-avatar">{initials}</div>
              <div className="profile-info">
                <div className="profile-name">{user?.name ?? 'User'}</div>
                <div className="profile-email" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{
                    width: 5, height: 5, borderRadius: '50%',
                    background: badge.color, display: 'inline-block', flexShrink: 0
                  }} />
                  {badge.label}
                </div>
              </div>
              <ChevronUp size={13} className={`profile-chevron ${profileOpen ? 'rotated' : ''}`} />
            </div>

            {/* Dropdown */}
            {profileOpen && (
              <div className="profile-dropdown">
                <div className="profile-dropdown-user">
                  <div className="profile-avatar-lg">{initials}</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{user?.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{user?.email}</div>
                    <div style={{
                      fontSize: 10, marginTop: 3, fontWeight: 600,
                      color: badge.color, textTransform: 'uppercase', letterSpacing: 0.5
                    }}>
                      {badge.label}
                    </div>
                  </div>
                </div>
                <div className="profile-dropdown-divider" />
                <button className="profile-dropdown-item"
                  onClick={() => { navigate('/settings'); setProfileOpen(false); setMobileMenuOpen(false) }}>
                  <UserCircle size={14} /> My Profile
                </button>
                <div className="profile-dropdown-divider" />
                <button className="profile-dropdown-item danger" onClick={handleLogout}>
                  <LogOut size={14} /> Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
