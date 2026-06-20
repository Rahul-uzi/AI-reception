// src/pages/ContactsPage.jsx
import { useState, useEffect, useMemo } from 'react'
import Sidebar from '../components/shared/Sidebar'
import Badge from '../components/shared/Badge'
import { fetchContacts, createContact, updateContact, deleteContact } from '../lib/api'
import { useToast } from '../components/shared/Toast'
import { UserPlus, Search, X, Phone, Mail, Clock, Edit2, Trash2, Users } from 'lucide-react'

function relativeTime(ts) {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function initials(name) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

const TAG_COLORS = { vip: 'purple', patient: 'green', new: 'amber', partner: 'purple' }

export default function ContactsPage() {
  const { addToast } = useToast()
  const [contacts, setContacts] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [selected, setSelected] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editing,  setEditing]  = useState(null)

  async function load() {
    setLoading(true)
    try {
      const data = await fetchContacts()
      setContacts(data)
    } catch (err) {
      addToast(`Architectural Failure: ${err.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return contacts
    const q = search.toLowerCase()
    return contacts.filter(c =>
      c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.email.toLowerCase().includes(q)
    )
  }, [contacts, search])

  async function handleDelete(id) {
    if (!confirm('Delete this contact?')) return
    try {
      await deleteContact(id)
      setContacts(prev => prev.filter(c => c.id !== id))
      if (selected?.id === id) setSelected(null)
      addToast('Contact purged from architecture', 'success')
    } catch (err) {
      addToast('Failed to purge contact', 'error')
    }
  }

  async function handleSave(data) {
    try {
      if (editing) {
        const updated = await updateContact(editing.id, data)
        setContacts(prev => prev.map(c => c.id === editing.id ? { ...c, ...updated } : c))
        addToast('Architecture updated successfully', 'success')
      } else {
        const created = await createContact(data)
        setContacts(prev => [created, ...prev])
        addToast('New entry committed to architecture', 'success')
      }
      setShowForm(false); setEditing(null)
    } catch (err) {
      addToast('Critical Save Error', 'error')
    }
  }

  const [selectedIds, setSelectedIds] = useState(new Set())

  const toggleSelect = (id, e) => {
    e.stopPropagation()
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} contacts?`)) return
    const ids = Array.from(selectedIds)
    try {
      await Promise.all(ids.map(id => deleteContact(id)))
      setContacts(prev => prev.filter(c => !selectedIds.has(c.id)))
      setSelectedIds(new Set())
      addToast(`Batch purge complete: ${ids.length} records removed`, 'success')
    } catch (err) {
      addToast('Batch purge failure', 'error')
    }
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-content">
        <div className="page-header">
          <div>
            <h1 className="page-title">Contacts</h1>
            <p className="page-sub">{contacts.length} entries in architecture</p>
          </div>
          <div className="flex gap-2">
            {selectedIds.size > 0 && (
              <button className="btn-ghost icon-btn danger" onClick={handleBulkDelete} style={{ color: 'var(--red)' }}>
                <Trash2 size={14} /> Purge Selected ({selectedIds.size})
              </button>
            )}
            <button className="btn-primary icon-btn" onClick={() => { setEditing(null); setShowForm(true) }}>
              <UserPlus size={14} /> New Entry
            </button>
          </div>
        </div>

        <div className="toolbar" style={{ marginBottom: 20 }}>
          <div className="search-box">
            <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input placeholder="Search architecture…" value={search} onChange={e => setSearch(e.target.value)} />
            {search && <button onClick={() => setSearch('')} style={{ background:'none', color:'var(--text-muted)', padding:0 }}><X size={14}/></button>}
          </div>
        </div>

        {loading ? (
          <div className="empty-state"><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <Users size={32} style={{ color: 'var(--text-dim)', marginBottom: 12 }} />
            <p>No architecture entries found</p>
          </div>
        ) : (
          <div className="contacts-grid">
            {filtered.map(contact => (
              <div key={contact.id} className={`contact-card ${selectedIds.has(contact.id) ? 'selected' : ''}`} onClick={() => setSelected(contact)}>
                <div className="flex items-center gap-3" style={{ marginBottom: 12 }}>
                  <div 
                    className={`checkbox ${selectedIds.has(contact.id) ? 'checked' : ''}`} 
                    onClick={e => toggleSelect(contact.id, e)}
                  />
                  <div className="avatar-md">{initials(contact.name)}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:500, fontSize:14, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{contact.name}</div>
                    <div style={{ fontSize:12, color:'var(--text-muted)', fontFamily:'var(--mono)' }}>{contact.phone}</div>
                  </div>
                  <div className="flex gap-1">
                    <button className="card-action-btn" onClick={e => { e.stopPropagation(); setEditing(contact); setShowForm(true) }}><Edit2 size={13}/></button>
                    <button className="card-action-btn danger" onClick={e => { e.stopPropagation(); handleDelete(contact.id) }}><Trash2 size={13}/></button>
                  </div>
                </div>
                <div className="flex gap-2" style={{ flexWrap:'wrap', marginBottom:10 }}>
                  {contact.tags?.map(t => <Badge key={t} variant={TAG_COLORS[t] ?? 'muted'}>{t}</Badge>)}
                </div>
                <div className="flex justify-between" style={{ fontSize:11, color:'var(--text-muted)' }}>
                  <span>{contact.calls} calls</span>
                  <span>{relativeTime(contact.lastCall)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {selected && !showForm && (
        <>
          <div className="drawer-overlay" onClick={() => setSelected(null)} />
          <aside className="drawer">
            <div className="drawer-header">
              <div className="flex items-center gap-3">
                <div className="avatar-lg">{initials(selected.name)}</div>
                <div>
                  <div style={{ fontWeight:600, fontSize:16 }}>{selected.name}</div>
                  <div style={{ fontSize:12, color:'var(--text-muted)' }}>Contact</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="icon-close" onClick={() => { setEditing(selected); setShowForm(true); setSelected(null) }}><Edit2 size={14}/></button>
                <button className="icon-close" onClick={() => setSelected(null)}><X size={16}/></button>
              </div>
            </div>
            <div className="drawer-body">
              <div className="drawer-section">
                <div className="drawer-section-title">Contact Info</div>
                <div className="contact-info-row"><Phone size={13}/> {selected.phone}</div>
                <div className="contact-info-row"><Mail size={13}/> {selected.email}</div>
                <div className="contact-info-row"><Clock size={13}/> Last call {relativeTime(selected.lastCall)}</div>
              </div>
              {selected.tags?.length > 0 && (
                <div className="drawer-section">
                  <div className="drawer-section-title">Tags</div>
                  <div className="flex gap-2" style={{ flexWrap:'wrap' }}>
                    {selected.tags.map(t => <Badge key={t} variant={TAG_COLORS[t] ?? 'muted'}>{t}</Badge>)}
                  </div>
                </div>
              )}
              {selected.notes && (
                <div className="drawer-section">
                  <div className="drawer-section-title">Notes</div>
                  <p style={{ fontSize:13, color:'var(--text-muted)', lineHeight:1.7 }}>{selected.notes}</p>
                </div>
              )}
              <div className="drawer-section">
                <div className="drawer-section-title">Activity</div>
                <div style={{ fontSize:28, fontWeight:700 }}>{selected.calls}</div>
                <div style={{ fontSize:12, color:'var(--text-muted)' }}>total AI-handled calls</div>
              </div>
            </div>
          </aside>
        </>
      )}

      {showForm && (
        <ContactForm initial={editing} onSave={handleSave} onClose={() => { setShowForm(false); setEditing(null) }} />
      )}
    </div>
  )
}

function ContactForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState({
    name:  initial?.name  ?? '',
    phone: initial?.phone ?? '',
    email: initial?.email ?? '',
    notes: initial?.notes ?? '',
    tags:  initial?.tags?.join(', ') ?? '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  function submit(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.phone.trim()) return
    onSave({ ...form, tags: form.tags.split(',').map(t => t.trim()).filter(Boolean) })
  }
  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <span style={{ fontWeight:600 }}>{initial ? 'Edit Contact' : 'New Contact'}</span>
          <button className="icon-close" onClick={onClose}><X size={16}/></button>
        </div>
        <form onSubmit={submit} className="modal-body">
          <label className="form-label">Name *<input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Full name" required/></label>
          <label className="form-label">Phone *<input className="form-input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+1 (555) 000-0000" required/></label>
          <label className="form-label">Email<input className="form-input" value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@example.com" type="email"/></label>
          <label className="form-label">Tags (comma-separated)<input className="form-input" value={form.tags} onChange={e => set('tags', e.target.value)} placeholder="vip, patient, new"/></label>
          <label className="form-label">Notes<textarea className="form-input" value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} placeholder="Internal notes…" style={{ resize:'vertical' }}/></label>
          <div className="flex justify-between" style={{ marginTop:8 }}>
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">Save Contact</button>
          </div>
        </form>
      </div>
    </div>
  )
}
