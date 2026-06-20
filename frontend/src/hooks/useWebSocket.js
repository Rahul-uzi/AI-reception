// src/hooks/useWebSocket.js
import { useEffect, useRef, useCallback } from 'react'

const WS_URL = `ws://${window.location.host}/ws`

export function useWebSocket({ onTranscript, onStatusChange, onTTS }) {
  const ws = useRef(null)

  const connect = useCallback(() => {
    ws.current = new WebSocket(WS_URL)

    ws.current.onopen = () => {
      console.log('WS connected')
    }

    ws.current.onclose = () => {
      onStatusChange('disconnected')
    }

    ws.current.onerror = (e) => {
      console.error('WS error', e)
      onStatusChange('disconnected')
    }

    ws.current.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)

        if (data.type === 'status')     onStatusChange(data.value)
        if (data.type === 'transcript') onTranscript(data)
        if (data.type === 'tts')        onTTS?.(data.text)
      } catch (err) {
        console.error('WS parse error', err)
      }
    }
  }, [])

  // Send user transcript to backend
  const sendTranscript = useCallback((text) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: 'user_transcript', text }))
    }
  }, [])

  // Tell backend call ended
  const endCall = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: 'end_call' }))
    }
    ws.current?.close()
  }, [])

  useEffect(() => () => ws.current?.close(), [])

  return { connect, endCall, sendTranscript }
}
