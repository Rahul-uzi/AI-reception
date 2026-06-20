import Badge from '../shared/Badge'
import { Trash2 } from 'lucide-react'

const STATUS_TYPE = { Completed:'green', Missed:'red', Active:'purple', Incomplete:'muted' }

function formatTime(ts) {
  if (!ts) return '—'
  // Fix Safari parsing by stripping fractional seconds if present, and handling naive dates
  const safeTs = ts.includes('Z') || ts.includes('+') ? ts : ts.split('.')[0]
  const d = new Date(safeTs)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' })
}

export default function CallTable({ calls = [], onSelect, onDelete, canDelete }) {
  return (
    <div className="calls-section">
      <div className="calls-section-header">
        <span>Recent Calls</span>
        <span style={{ fontSize:12, color:'var(--text-muted)' }}>
          {calls.length} total
        </span>
      </div>

      {calls.length === 0 ? (
        <div style={{ padding:'32px 20px', textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>
          No calls yet. Click <strong style={{color:'var(--purple)'}}>New Call</strong> to start one.
        </div>
      ) : (
        <table className="calls-table">
          <thead>
            <tr>
              <th>Caller</th>
              <th>Duration</th>
              <th>Time</th>
              <th>Status</th>
              <th>Summary</th>
              {canDelete && <th style={{ width: 40 }}></th>}
            </tr>
          </thead>
          <tbody>
            {calls.map((c) => (
              <tr key={c.id}>
                <td onClick={() => onSelect?.(c)}><span className="phone">{c.phone}</span></td>
                <td onClick={() => onSelect?.(c)} style={{ fontFamily:'var(--mono)', fontSize:12 }}>{c.duration}</td>
                <td onClick={() => onSelect?.(c)} style={{ color:'var(--text-muted)', fontSize:12 }}>{formatTime(c.timestamp)}</td>
                <td onClick={() => onSelect?.(c)}><Badge variant={STATUS_TYPE[c.status] ?? 'muted'}>{c.status}</Badge></td>
                <td onClick={() => onSelect?.(c)} style={{ color:'var(--text-muted)' }}>{c.outcome}</td>
                {canDelete && (
                  <td>
                    <button 
                      className="btn-ghost icon-btn delete-hover" 
                      onClick={(e) => {
                        e.stopPropagation()
                        if (confirm('Delete this call record?')) onDelete?.(c.id)
                      }}
                      style={{ color: 'var(--text-muted)', padding: 6 }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
