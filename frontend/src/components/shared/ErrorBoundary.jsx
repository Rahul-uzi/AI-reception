import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center" style={{ height: '100vh', padding: 40, textAlign: 'center' }}>
          <AlertTriangle size={48} color="var(--red)" style={{ marginBottom: 20 }} />
          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Architectural Crash Detected</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: 24, maxWidth: 400 }}>
            The stress test triggered a critical failure in the component tree. The architecture is resilient enough to isolate this crash.
          </p>
          <button className="btn-primary icon-btn" onClick={() => window.location.reload()}>
            <RefreshCw size={14} /> Re-initialize Architecture
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
