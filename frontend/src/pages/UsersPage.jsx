// src/pages/UsersPage.jsx — Admin-only user management page
import { useState, useEffect } from 'react'
import Sidebar from '../components/shared/Sidebar'
import { useAuthStore } from '../store/authStore'
import { useToast } from '../components/shared/Toast'
import { Shield, Plus, Edit2, Trash2, X, Loader, User, Search } from 'lucide-react'

const BASE = import.meta.env.VITE_API_URL || ''

const ROLE_COLOR = { admin: '#a78bfa', manager: '#60a5fa', viewer: '#34d399' }

function getToken() {
  try {
    const stored = localStorage.getItem('ai-receptionist-auth')
    return stored ? JSON.parse(stored)?.state?.token : null
  } catch { return null }
}

async function apiFetch(path, opts = {}) {
  const token = getToken()
  const headers = { 'Content-Type': 'application/json', ...opts.headers }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${BASE}${path}`, { ...opts, headers })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export default function UsersPage() {
  const { addToast } = useToast()
  const currentUser  = useAuthStore(s => s.user)
  const [users,   setUsers]   = useState([])
  const [loading, setLoading] = useState(true)
  const [modal,   setModal]   = useState(null)
  
  // New Filter States
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter,  setRoleFilter]  = useState('all') // all | admin | manager | viewer

  async function loadUsers() {
    setLoading(true)
    try {
      const data = await apiFetch('/users')
      setUsers(data)
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadUsers() }, [])

  async function handleDelete(user) {
    if (!confirm(`Delete user "${user.name}"? This cannot be undone.`)) return
    try {
      await apiFetch(`/users/${user.id}`, { method: 'DELETE' })
      addToast('User deleted', 'success')
      loadUsers()
    } catch (err) { addToast(err.message, 'error') }
  }

  // Filtering Logic
  const filteredUsers = users.filter(u => {
    const matchesRole   = roleFilter === 'all' || u.role === roleFilter
    const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         u.email.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesRole && matchesSearch
  })

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-content">
        <div className="page-header">
          <div>
            <h1 className="page-title">User Management</h1>
            <p className="page-sub">Manage admin, manager, and viewer accounts</p>
          </div>
          <button className="btn-primary icon-btn" onClick={() => setModal('create')}>
            <Plus size={14} /> Add User
          </button>
        </div>

        {/* Filters & Search Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 8, background: 'var(--surface2)', padding: 4, borderRadius: 10, border: '1px solid var(--border)' }}>
            {['all', 'admin', 'manager', 'viewer'].map(role => (
              <button
                key={role}
                onClick={() => setRoleFilter(role)}
                style={{
                  padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  textTransform: 'capitalize', cursor: 'pointer', border: 'none',
                  background: roleFilter === role ? 'var(--purple)' : 'transparent',
                  color: roleFilter === role ? 'white' : 'var(--text-muted)',
                  transition: 'all 0.2s',
                }}
              >
                {role}
              </button>
            ))}
          </div>

          <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%', padding: '9px 12px 9px 36px', fontSize: 13,
                border: '1px solid var(--border)', borderRadius: 10,
                background: 'var(--surface2)', color: 'var(--text)',
                outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font)'
              }}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="card" style={{ overflow: 'hidden' }}>
          {loading ? (
            <div className="empty-state"><div className="spinner" /></div>
          ) : (
            <table className="calls-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Joined</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length > 0 ? filteredUsers.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%',
                          background: `${ROLE_COLOR[u.role] ?? '#6b7280'}22`,
                          border: `1px solid ${ROLE_COLOR[u.role] ?? '#6b7280'}44`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 700, color: ROLE_COLOR[u.role] ?? '#6b7280'
                        }}>
                          {u.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 500 }}>{u.name}</span>
                        {u.id === currentUser?.id && (
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 5px' }}>You</span>
                        )}
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{u.email}</td>
                    <td>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 99,
                        background: `${ROLE_COLOR[u.role] ?? '#6b7280'}22`,
                        color: ROLE_COLOR[u.role] ?? '#6b7280',
                        textTransform: 'capitalize'
                      }}>{u.role}</span>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button className="btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }}
                          onClick={() => setModal(u)}>
                          <Edit2 size={12} /> Edit
                        </button>
                        {u.id !== currentUser?.id && (
                          <button className="btn-ghost" style={{ padding: '5px 10px', fontSize: 12, color: 'var(--red)' }}
                            onClick={() => handleDelete(u)}>
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                      No users found matching your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {modal && (
        <UserModal
          user={modal === 'create' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); loadUsers() }}
          addToast={addToast}
        />
      )}
    </div>
  )
}

function UserModal({ user, onClose, onSaved, addToast }) {
  const isEdit = !!user
  const [form, setForm] = useState({
    name:     user?.name  ?? '',
    email:    user?.email ?? '',
    role:     user?.role  ?? 'viewer',
    phone:    user?.phone ?? '',
    password: ''
  })
  const [loading, setLoading] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const body = { ...form }
      if (isEdit && !body.password) delete body.password
      if (isEdit) {
        await apiFetch(`/users/${user.id}`, { method: 'PUT', body: JSON.stringify(body) })
        addToast('User updated', 'success')
      } else {
        await apiFetch('/users', { method: 'POST', body: JSON.stringify(body) })
        addToast('User created', 'success')
      }
      onSaved()
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <div style={{ fontWeight: 600 }}>{isEdit ? 'Edit User' : 'Add New User'}</div>
          <button className="icon-close" onClick={onClose}><X size={15} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[
            { label: 'Full Name', key: 'name',  type: 'text',     required: true },
            { label: 'Email',     key: 'email', type: 'email',    required: true },
            { label: 'Phone',     key: 'phone', type: 'tel',      required: false },
            { label: isEdit ? 'New Password (leave blank to keep)' : 'Password', key: 'password', type: 'password', required: !isEdit },
          ].map(({ label, key, type, required }) => (
            <div key={key}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                {label}
              </label>
              <input
                type={type}
                value={form[key]}
                onChange={e => set(key, e.target.value)}
                required={required}
                style={{
                  width: '100%', padding: '9px 12px', fontSize: 13,
                  border: '1px solid var(--border)', borderRadius: 8,
                  background: 'var(--surface2)', color: 'var(--text)',
                  outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font)'
                }}
                onFocus={e => e.target.style.borderColor = 'var(--purple)'}
                onBlur={e  => e.target.style.borderColor = 'var(--border)'}
              />
            </div>
          ))}

          {/* Role */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Role</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['admin','manager','viewer'].map(r => (
                <button key={r} type="button"
                  onClick={() => set('role', r)}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    border: `1px solid ${form.role === r ? ROLE_COLOR[r] : 'var(--border)'}`,
                    background: form.role === r ? `${ROLE_COLOR[r]}18` : 'var(--surface2)',
                    color: form.role === r ? ROLE_COLOR[r] : 'var(--text-muted)',
                    cursor: 'pointer', textTransform: 'capitalize', fontFamily: 'var(--font)'
                  }}>
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={loading}>
              {loading ? <Loader size={14} /> : (isEdit ? 'Save Changes' : 'Create User')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
