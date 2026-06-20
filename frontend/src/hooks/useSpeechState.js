import { useState } from 'react'

// status: 'idle' | 'listening' | 'speaking'
export function useSpeechState() {
  const [status, setStatus] = useState('idle')
  return { status, setStatus }
}
