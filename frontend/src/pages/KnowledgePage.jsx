// src/pages/KnowledgePage.jsx
import { useState, useEffect } from 'react'
import Sidebar from '../components/shared/Sidebar'
import Badge from '../components/shared/Badge'
import { fetchKnowledge, createKnowledgeItem, updateKnowledgeItem, deleteKnowledgeItem } from '../lib/api'
import { BookOpen, Plus, X, Edit2, Trash2, Search, FileText, Lightbulb, ShieldAlert, CreditCard, MapPin } from 'lucide-react'

const CATEGORY_MAP = {
  General: { color: 'purple', icon: Lightbulb },
  Process: { color: 'green',  icon: FileText },
  Billing: { color: 'amber',  icon: CreditCard },
  Policy:  { color: 'blue',   icon: ShieldAlert },
  FAQ:     { color: 'rose',   icon: BookOpen },
  Appointments: { color: 'indigo', icon: BookOpen }
}

function timeAgo(dateStr) {
  if (!dateStr) return 'unknown'
  const ts = new Date(dateStr).getTime()
  if (isNaN(ts)) return 'unknown'
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

export default function KnowledgePage() {
  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [active,  setActive]  = useState(null)
  const [editing, setEditing] = useState(false)
  const [showNew, setShowNew] = useState(false)

  async function load() {
    setLoading(true)
    const data = await fetchKnowledge()
    setItems(data)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filtered = items.filter(it =>
    it.title.toLowerCase().includes(search.toLowerCase()) ||
    it.content.toLowerCase().includes(search.toLowerCase()) ||
    it.category.toLowerCase().includes(search.toLowerCase())
  )

  async function handleDelete(id) {
    if (!confirm('Delete this knowledge item?')) return
    await deleteKnowledgeItem(id)
    setItems(prev => prev.filter(i => i.id !== id))
    if (active?.id === id) setActive(null)
  }

  async function handleSave(data) {
    if (active && editing) {
      const updated = await updateKnowledgeItem(active.id, data)
      setItems(prev => prev.map(i => i.id === active.id ? { ...i, ...updated, updated_at: new Date().toISOString() } : i))
      setActive({ ...active, ...data, updated_at: new Date().toISOString() })
    } else {
      const created = await createKnowledgeItem(data)
      setItems(prev => [created, ...prev])
    }
    setEditing(false); setShowNew(false)
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-content">
        <div className="page-header">
          <div>
            <h1 className="page-title">Knowledge Base</h1>
            <p className="page-sub">Powering Brittany's intelligence with real-time RAG</p>
          </div>
          <button className="btn-primary" onClick={() => { setActive(null); setEditing(false); setShowNew(true) }}>
            <Plus size={16} /> New Article
          </button>
        </div>

        <div className="knowledge-grid">
          {/* List Sidebar */}
          <div className="kb-sidebar card">
            <div className="kb-search">
              <Search size={14} className="kb-search-icon" />
              <input 
                placeholder="Search articles..." 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
              />
            </div>
            
            <div className="kb-list scrollbar-hide">
              {loading ? (
                <div className="kb-loading"><div className="spinner" /></div>
              ) : filtered.length === 0 ? (
                <div className="kb-empty">No articles found</div>
              ) : filtered.map(item => {
                const cfg = CATEGORY_MAP[item.category] || CATEGORY_MAP.General
                const Icon = cfg.icon
                return (
                  <div 
                    key={item.id} 
                    className={`kb-item ${active?.id === item.id ? 'active' : ''}`}
                    onClick={() => { setActive(item); setEditing(false); setShowNew(false) }}
                  >
                    <div className={`kb-item-icon bg-${cfg.color}`}>
                      <Icon size={14} />
                    </div>
                    <div className="kb-item-meta">
                      <div className="kb-item-title">{item.title}</div>
                      <div className="kb-item-sub">
                        <span className={`text-${cfg.color}`}>{item.category}</span>
                        <span className="dot" />
                        {timeAgo(item.updated_at)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Content Pane */}
          <div className="kb-content card">
            {showNew ? (
              <KnowledgeForm onSave={handleSave} onClose={() => setShowNew(false)} />
            ) : active ? (
              <div className="kb-detail animate-fade-in">
                <div className="kb-detail-header">
                  <div className="flex items-center gap-3">
                    {(() => {
                      const cfg = CATEGORY_MAP[active.category] || CATEGORY_MAP.General
                      const Icon = cfg.icon
                      return (
                        <div className={`kb-item-icon bg-${cfg.color}`}>
                          <Icon size={16} />
                        </div>
                      )
                    })()}
                    <div>
                      <div className="kb-detail-cat">{active.category}</div>
                      <h2 className="kb-detail-title">{active.title}</h2>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn-icon" onClick={() => setEditing(true)} title="Edit Article">
                      <Edit2 size={14} />
                    </button>
                    <button className="btn-icon danger" onClick={() => handleDelete(active.id)} title="Delete Article">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {editing ? (
                  <KnowledgeForm initial={active} onSave={handleSave} onClose={() => setEditing(false)} />
                ) : (
                  <div className="kb-detail-body">
                    <div className="kb-detail-timestamp">
                      Last updated {timeAgo(active.updated_at)} by System
                    </div>
                    <div className="kb-content-text">
                      {active.content}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="kb-placeholder">
                <div className="kb-placeholder-icon">
                  <BookOpen size={48} />
                </div>
                <h3>Knowledge Base</h3>
                <p>Select an article from the left to view or edit the details Brittany uses to answer questions.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      <style>{`
        .knowledge-grid {
          display: grid;
          grid-template-columns: minmax(240px, 300px) 1fr;
          gap: 16px;
          height: calc(100vh - 160px);
        }
        @media (max-width: 1200px) {
          .knowledge-grid { grid-template-columns: 240px 1fr; gap: 12px; }
        }
        @media (max-width: 900px) {
          .knowledge-grid { 
            grid-template-columns: 1fr; 
            height: auto;
            display: flex;
            flex-direction: column;
          }
          .kb-sidebar { height: 350px; }
          .kb-content { min-height: 500px; }
        }
        .kb-sidebar {
          display: flex;
          flex-direction: column;
          padding: 16px 0;
          overflow: hidden;
        }
        .kb-search {
          margin: 0 16px 16px;
          position: relative;
          display: flex;
          align-items: center;
        }
        .kb-search input {
          width: 100%;
          background: var(--surface2);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 10px 12px 10px 36px;
          font-size: 13px;
          color: var(--text);
          transition: all 0.2s;
        }
        .kb-search input:focus {
          border-color: var(--purple);
          box-shadow: 0 0 0 3px rgba(167, 139, 250, 0.1);
        }
        .kb-search-icon {
          position: absolute;
          left: 12px;
          color: var(--text-muted);
        }
        .kb-list {
          flex: 1;
          overflow-y: auto;
          padding: 0 8px;
        }
        .kb-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
          margin-bottom: 4px;
        }
        .kb-item:hover {
          background: var(--surface2);
        }
        .kb-item.active {
          background: var(--surface3);
          border: 1px solid var(--border);
        }
        .kb-item-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .bg-purple { background: rgba(167, 139, 250, 0.1); color: var(--purple); }
        .bg-green  { background: rgba(34, 197, 94, 0.1);   color: var(--green); }
        .bg-amber  { background: rgba(245, 158, 11, 0.1);  color: var(--amber); }
        .bg-blue   { background: rgba(59, 130, 246, 0.1);  color: var(--blue); }
        .bg-rose   { background: rgba(244, 63, 94, 0.1);   color: var(--rose); }
        .bg-indigo { background: rgba(99, 102, 241, 0.1);  color: var(--indigo); }
        
        .kb-item-title { font-size: 13px; font-weight: 500; margin-bottom: 2px; }
        .kb-item-sub { font-size: 11px; color: var(--text-muted); display: flex; align-items: center; gap: 6px; }
        .dot { width: 3px; height: 3px; border-radius: 50%; background: var(--text-dim); }
        
        .kb-content {
          padding: 0;
          overflow: hidden;
          background: var(--surface);
          border: 1px solid var(--border);
          min-width: 0;
        }
        .kb-detail {
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        .kb-detail-header {
          padding: 24px;
          border-bottom: 1px solid var(--border);
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
        }
        .kb-detail-cat { font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.5px; }
        .kb-detail-title { font-size: 20px; font-weight: 600; margin-top: 2px; }
        
        .kb-detail-body {
          padding: 32px;
          flex: 1;
          overflow-y: auto;
        }
        .kb-detail-timestamp { font-size: 12px; color: var(--text-muted); margin-bottom: 24px; }
        .kb-content-text {
          font-size: 15px;
          line-height: 1.8;
          color: var(--text);
          white-space: pre-wrap;
          font-family: var(--font);
        }
        .kb-placeholder {
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px;
          text-align: center;
        }
        .kb-placeholder-icon {
          width: 80px;
          height: 80px;
          border-radius: 20px;
          background: var(--surface2);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 20px;
          color: var(--text-dim);
        }
        .kb-placeholder h3 { font-size: 18px; margin-bottom: 8px; }
        .kb-placeholder p { font-size: 14px; color: var(--text-muted); max-width: 320px; }
        
        .btn-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          border: 1px solid var(--border);
          background: var(--surface);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          transition: all 0.2s;
        }
        .btn-icon:hover { background: var(--surface2); color: var(--text); }
        .btn-icon.danger:hover { background: rgba(244, 63, 94, 0.1); color: var(--rose); border-color: rgba(244, 63, 94, 0.2); }
      `}</style>
    </div>
  )
}

function KnowledgeForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState({
    title:    initial?.title    ?? '',
    category: initial?.category ?? 'General',
    content:  initial?.content  ?? '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  function submit(e) {
    e.preventDefault()
    if (!form.title.trim() || !form.content.trim()) return
    onSave(form)
  }
  return (
    <form onSubmit={submit} className="kb-form animate-fade-in">
      <div className="kb-form-header">
        <div>
          <h2>{initial ? 'Edit Knowledge' : 'New Knowledge'}</h2>
          <p>This information will be available to the AI via RAG.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary">Save Changes</button>
        </div>
      </div>
      
      <div className="kb-form-body">
        <label className="form-label">Article Title
          <input className="form-input" value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Refund Policy" required/>
        </label>
        
        <label className="form-label">Category
          <select className="form-input" value={form.category} onChange={e => set('category', e.target.value)}>
            {['General','Process','Billing','Policy','FAQ','Appointments'].map(c => <option key={c}>{c}</option>)}
          </select>
        </label>
        
        <label className="form-label flex-grow-label">Content
          <textarea 
            className="form-input content-textarea" 
            value={form.content} 
            onChange={e => set('content', e.target.value)} 
            placeholder="Describe the information in detail..." 
            required 
          />
        </label>
      </div>

      <style>{`
        .kb-form { display: flex; flex-direction: column; height: 100%; }
        .kb-form-header { 
          padding: 24px; 
          border-bottom: 1px solid var(--border); 
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: var(--surface);
          position: sticky;
          top: 0;
          z-index: 10;
          gap: 16px;
        }
        @media (max-width: 600px) {
          .kb-form-header {
            flex-direction: column;
            align-items: flex-start;
          }
          .kb-form-header .flex {
            width: 100%;
            justify-content: space-between;
          }
        }
        .kb-form-header h2 { font-size: 18px; font-weight: 600; }
        .kb-form-header p { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
        .kb-form-body { 
          padding: 24px; 
          flex: 1; 
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .flex-grow-label {
          flex: 1;
          display: flex;
          flex-direction: column;
          margin-bottom: 0 !important;
        }
        .content-textarea {
          flex: 1;
          resize: none;
          margin-top: 8px;
        }
        .kb-form .form-input { margin-bottom: 16px; width: 100%; box-sizing: border-box; }
      `}</style>
    </form>
  )
}

