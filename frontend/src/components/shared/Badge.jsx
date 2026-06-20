// src/components/shared/Badge.jsx
export default function Badge({ variant = 'muted', children }) {
  return <span className={`badge badge-${variant}`}>{children}</span>
}
