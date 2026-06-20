// src/pages/CallPage.jsx — sends raw PCM audio to Pipecat
import { useEffect, useRef, useState } from 'react'
import { useNavigate }  from 'react-router-dom'
import { useCallStore } from '../store/callStore'
import { useCallTimer } from '../hooks/useCallTimer'
import WaveformOrb      from '../components/call/WaveformOrb'
import CallStatus       from '../components/call/CallStatus'
import CallControls     from '../components/call/CallControls'
import TranscriptPanel  from '../components/call/TranscriptPanel'
import { Mic }          from 'lucide-react'

const WS_URL = import.meta.env.VITE_WS_URL || `ws://${window.location.host}/ws`

export default function CallPage({ isPublic = false }) {
  const navigate = useNavigate()
  const { status, setStatus, addMessage, reset } = useCallStore()
  const [running, setRunning] = useState(false)
  const timer = useCallTimer(running)

  const wsRef       = useRef(null)
  const activeRef   = useRef(true)
  const speakingRef = useRef(false)
  const mutedRef    = useRef(false) // Ref for instant access in audio thread
  const [isMuted, setIsMuted] = useState(false)
  
  // Mic input (capture)
  const audioCtxRef   = useRef(null)
  const processorRef  = useRef(null)
  const streamRef     = useRef(null)

  // Bot audio output (playback) — separate context avoids conflicts
  const playCtxRef      = useRef(null)
  const nextPlayTimeRef = useRef(0)
  const lastAudioTimeRef = useRef(0)
  const audioQueueRef   = useRef([])  // buffer audio arriving before ctx is ready

  const analyserRef   = useRef(null)
  const aiAnalyserRef = useRef(null)
  const animationFrameIdRef = useRef(null)


  // ── Playback AudioContext (bot voice) ────────────────────────
  function ensurePlayCtx() {
    if (!playCtxRef.current) {
      const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 })
      playCtxRef.current = ctx
      nextPlayTimeRef.current = 0

      // Setup analyser for AI playback
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 64
      analyser.connect(ctx.destination)
      aiAnalyserRef.current = analyser
    }
    return playCtxRef.current
  }

  // ── PCM Mic Capture ──────────────────────────────────────────
  async function startAudio() {
    // Ensure playback context exists (needs user gesture)
    const pCtx = ensurePlayCtx()
    await pCtx.resume()

    // Drain any audio that arrived before context was ready
    const queued = audioQueueRef.current.splice(0)
    for (const buf of queued) schedulePCM(pCtx, buf)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        }
      })
      streamRef.current = stream

      const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 })
      await audioCtx.resume()
      audioCtxRef.current = audioCtx

      // Setup analyser for user microphone
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 64
      analyserRef.current = analyser

      const source = audioCtx.createMediaStreamSource(stream)
      source.connect(analyser)

      const processor = audioCtx.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor
      analyser.connect(processor)

      processor.onaudioprocess = (e) => {
        if (!activeRef.current || speakingRef.current || mutedRef.current) return
        if (wsRef.current?.readyState !== WebSocket.OPEN) return
        const inputData = e.inputBuffer.getChannelData(0)
        const pcmData = new Int16Array(inputData.length)
        for (let i = 0; i < inputData.length; i++) {
          pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF
        }
        wsRef.current.send(pcmData.buffer)
      }

      processor.connect(audioCtx.destination)
      setStatus('listening')
      console.log('🎤 Mic streaming started')

    } catch (err) {
      console.error('Mic error:', err)
      alert('Microphone access denied. Please allow mic access and reload.')
    }
  }

  function stopAudio() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    processorRef.current?.disconnect()
    audioCtxRef.current?.close()
    playCtxRef.current?.close()
    streamRef.current?.getTracks().forEach(t => t.stop())
    processorRef.current = null
    audioCtxRef.current = null
    playCtxRef.current = null
    streamRef.current = null
    audioQueueRef.current = []
    analyserRef.current = null
    aiAnalyserRef.current = null
  }

  // ── WebSocket ────────────────────────────────────────────────
  function connectWS() {
    console.log('🔗 Connecting to Pipecat at', WS_URL)
    const ws = new WebSocket(WS_URL)
    ws.binaryType = 'arraybuffer'  // MUST be set before any messages arrive
    wsRef.current = ws

    ws.onopen = () => {
      console.log('✅ Connected to Pipecat')
      setRunning(true)
    }

    ws.onclose = () => {
      console.log('❌ WebSocket closed')
      setRunning(false)
      const currentStatus = useCallStore.getState().status
      if (activeRef.current && currentStatus === 'connecting') {
        console.warn('⚠️ Backend not reached. Entering simulation mode...')
        startSimulation()
      }
      if (activeRef.current && currentStatus !== 'connecting') {
        if (currentStatus === 'saving') {
          console.log('🔌 WS closed during saving, redirecting to dashboard')
          if (window.teardownFallbackTimer) {
            clearTimeout(window.teardownFallbackTimer)
            window.teardownFallbackTimer = null
          }
          activeRef.current = false
          stopAudio()
          navigate(isPublic ? '/' : '/dashboard')
        } else {
          setStatus('disconnected')
        }
      }
    }

    ws.onmessage = (e) => {
      if (typeof e.data === 'string') {
        try {
          const data = JSON.parse(e.data)
          if (data.type === 'status') {
            // Ignore 'idle' from backend if we are still actively playing AI audio
            if (data.value === 'idle' && speakingRef.current) {
              return
            }
            const displayStatus = data.value === 'idle' ? 'listening' : data.value;
            useCallStore.getState().setStatus(displayStatus)
            speakingRef.current = (data.value === 'speaking')
          }
          if (data.type === 'transcript') {
            addMessage({ role: data.role, text: data.text, time: Date.now() })
            // Fallback TTS: Speak if it's the AI and we haven't heard audio for a bit
            if (data.role === 'ai') {
               const timeSinceLastAudio = Date.now() - (lastAudioTimeRef.current || 0)
               if (timeSinceLastAudio > 1000) {
                 speak(data.text)
               }
            }
          }
          if (data.type === 'summary_ready') {
            console.log('✅ Summary ready, navigating to dashboard')
            if (window.teardownFallbackTimer) {
              clearTimeout(window.teardownFallbackTimer)
              window.teardownFallbackTimer = null
            }
            activeRef.current = false
            stopAudio()
            wsRef.current?.close()
            navigate(isPublic ? '/' : '/dashboard')
          }
          if (data.type === 'hangup') {
            console.log('🛑 Hangup signal received from AI')
            setTimeout(() => handleEnd(), 2000)
          }
        } catch (err) { console.error('Parse error:', err) }
      } else if (e.data instanceof ArrayBuffer) {
        // Play binary PCM audio
        playPCM(e.data)
      }
    }
  }

  // ── Bot Audio Playback (PCM from ElevenLabs) ─────────────────
  function schedulePCM(ctx, arrayBuffer) {
    try {
      const pcmData   = new Int16Array(arrayBuffer)
      const float32   = new Float32Array(pcmData.length)
      for (let i = 0; i < pcmData.length; i++) float32[i] = pcmData[i] / 32768.0

      const buf = ctx.createBuffer(1, float32.length, 16000)
      buf.getChannelData(0).set(float32)

      const src = ctx.createBufferSource()
      src.buffer = buf
      
      if (aiAnalyserRef.current) {
        src.connect(aiAnalyserRef.current)
      } else {
        src.connect(ctx.destination)
      }

      const now = ctx.currentTime
      if (nextPlayTimeRef.current < now) nextPlayTimeRef.current = now + 0.05
      src.start(nextPlayTimeRef.current)
      nextPlayTimeRef.current += buf.duration
    } catch (err) {
      console.error('🔇 PCM playback error:', err)
    }
  }

  function playPCM(arrayBuffer) {
    lastAudioTimeRef.current = Date.now()
    
    // Instantly show AI is speaking when audio arrives
    const currentStatus = useCallStore.getState().status
    if (currentStatus !== 'speaking') {
      useCallStore.getState().setStatus('speaking')
      speakingRef.current = true
    }
    
    const ctx = playCtxRef.current
    
    const setSpeakingTimeout = () => {
      if (window.aiSpeakingTimeout) clearTimeout(window.aiSpeakingTimeout)
      const delay = ctx ? Math.max(0, (nextPlayTimeRef.current - ctx.currentTime) * 1000) : 800
      window.aiSpeakingTimeout = setTimeout(() => {
        useCallStore.getState().setStatus('listening')
        speakingRef.current = false
      }, delay + 1500)
    }

    if (!ctx || ctx.state === 'closed') {
      // Context not yet ready — queue for later
      audioQueueRef.current.push(arrayBuffer)
      setSpeakingTimeout()
      return
    }
    if (ctx.state === 'suspended') {
      ctx.resume().then(() => {
        schedulePCM(ctx, arrayBuffer)
        setSpeakingTimeout()
      })
      return
    }
    schedulePCM(ctx, arrayBuffer)
    setSpeakingTimeout()
  }

  // ── Browser TTS Fallback (Beney) ───────────────────────────
  function speak(text) {
    if (!('speechSynthesis' in window)) return
    
    // Cancel previous speech to avoid overlapping
    window.speechSynthesis.cancel()
    
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1.0
    utterance.pitch = 1.1 // Slightly higher for a friendly "Beney" persona
    
    // Pick a good English voice if available
    const voices = window.speechSynthesis.getVoices()
    const preferred = voices.find(v => v.name.includes('Google UK English Female') || v.name.includes('Samantha'))
    if (preferred) utterance.voice = preferred

    utterance.onstart = () => {
      useCallStore.getState().setStatus('speaking')
      speakingRef.current = true
    }

    const handleSpeechEnd = () => {
      useCallStore.getState().setStatus('listening')
      speakingRef.current = false
    }

    utterance.onend = handleSpeechEnd
    utterance.onerror = handleSpeechEnd
    
    window.speechSynthesis.speak(utterance)
  }

  // ── Simulation (for Demo) ────────────────────────────────────
  function startSimulation() {
    setRunning(true)
    setStatus('listening')
    
    // Simulate initial greeting
    setTimeout(() => {
      if (!activeRef.current) return
      const text = "Hello! I'm Beney, your AI receptionist. How can I help you today?"
      addMessage({ role: 'ai', text, time: Date.now() })
      setStatus('speaking')
      speak(text)
    }, 1500)

    // Simulate response to user
    const interval = setInterval(() => {
      if (!activeRef.current) { clearInterval(interval); return }
      // Only respond if we haven't responded in a while
      const transcript = useCallStore.getState().transcript
      const last = transcript[transcript.length - 1]
      
      if (last && last.role === 'user' && (Date.now() - last.time > 2000)) {
        setStatus('speaking')
        setTimeout(() => {
          if (!activeRef.current) return
          const responses = [
            "That sounds great! I'm Beney and I can help you with that.",
            "I've noted that down for you. How else can I help?",
            "Could you please tell me more about that?",
            "I'll make sure to pass that information along."
          ]
          const text = responses[Math.floor(Math.random() * responses.length)]
          addMessage({ role: 'ai', text, time: Date.now() })
          speak(text)
          setStatus('listening')
        }, 1000)
      }
    }, 3000)
  }
  useEffect(() => {
    reset()
    activeRef.current   = true
    setStatus('connecting')
    connectWS()
    const t = setTimeout(() => startAudio(), 800)
    return () => {
      clearTimeout(t)
      if (window.teardownFallbackTimer) {
        clearTimeout(window.teardownFallbackTimer)
        window.teardownFallbackTimer = null
      }
      activeRef.current = false
      stopAudio()
      wsRef.current?.close()
    }
  }, [])

  useEffect(() => {
    const runVisualizer = () => {
      const bars = document.querySelectorAll('#waveform-orb-container .orb-bar')
      if (bars.length === 0) {
        animationFrameIdRef.current = requestAnimationFrame(runVisualizer)
        return
      }

      if (status === 'listening' && analyserRef.current) {
        const analyser = analyserRef.current
        const dataArray = new Uint8Array(analyser.frequencyBinCount)
        analyser.getByteFrequencyData(dataArray)
        
        let sum = 0
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i]
        const average = sum / dataArray.length

        if (average > 1) {
          const time = Date.now() * 0.005
          const volumeAmplitude = Math.min(54, (average / 60) * 54) // Scale up amplitude based on volume
          bars.forEach((bar, index) => {
            const freqPercent = dataArray[index % dataArray.length] / 255
            const wave = Math.sin(time - index * 0.3) // Scrolling wave
            // Combine smooth wave scaled by volume with a little bit of local frequency texture
            const height = 16 + ((wave + 1) * 0.5 * volumeAmplitude) + (freqPercent * 15)
            bar.style.height = `${height}px`
          })
        } else {
          // Silent/Idle listening state: gentle idle wave
          const time = Date.now() * 0.003
          bars.forEach((bar, index) => {
            const h = 16 + Math.sin(time + index * 0.25) * 4
            bar.style.height = `${h}px`
          })
        }
      } else if (status === 'speaking') {
        let hasAudio = false
        if (aiAnalyserRef.current) {
          const analyser = aiAnalyserRef.current
          const dataArray = new Uint8Array(analyser.frequencyBinCount)
          analyser.getByteFrequencyData(dataArray)
          
          let sum = 0
          for (let i = 0; i < dataArray.length; i++) sum += dataArray[i]
          const average = sum / dataArray.length
          
          if (average > 1) {
            hasAudio = true
            const time = Date.now() * 0.007
            const volumeAmplitude = Math.min(54, (average / 80) * 54)
            bars.forEach((bar, index) => {
              const freqPercent = dataArray[index % dataArray.length] / 255
              const wave = Math.sin(time - index * 0.4) // Faster scrolling for AI speaking
              const height = 16 + ((wave + 1) * 0.5 * volumeAmplitude) + (freqPercent * 15)
              bar.style.height = `${height}px`
            })
          }
        }
        
        if (!hasAudio) {
          // Fallback animated wave when AI speaks
          const time = Date.now() * 0.007
          bars.forEach((bar, index) => {
            const waveHeight = 16 + Math.sin(time - index * 0.35) * 16 + Math.random() * 5
            bar.style.height = `${waveHeight}px`
          })
        }
      } else if (status === 'saving') {
        // Undulating processing wave animation
        const time = Date.now() * 0.005
        bars.forEach((bar, index) => {
          const waveHeight = 16 + Math.sin(time + index * 0.3) * 15
          bar.style.height = `${waveHeight}px`
        })
      } else if (status === 'muted') {
        bars.forEach(bar => {
          bar.style.height = '4px'
        })
      } else {
        bars.forEach(bar => {
          bar.style.height = '16px'
        })
      }

      animationFrameIdRef.current = requestAnimationFrame(runVisualizer)
    }

    runVisualizer()

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current)
      }
    }
  }, [status])

  function handleEnd() {
    activeRef.current = false
    stopAudio()
    setStatus('saving')
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('📤 Sending end_call signal, waiting for summary...')
      wsRef.current.send(JSON.stringify({ type: 'end_call' }))
      
      const fallbackTimer = setTimeout(() => {
        console.log('⏱️ Teardown safety fallback triggered')
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.close()
        }
        navigate('/dashboard')
      }, 6000)
      
      window.teardownFallbackTimer = fallbackTimer
    } else {
      navigate('/dashboard')
    }
  }

  return (
    <div className="call-layout">
      <div className="call-main">
        <div className="live-badge">
          <div className="dot" />
          LIVE
        </div>
        <div className="call-timer">{timer}</div>
        
        <div id="waveform-orb-container">
          <WaveformOrb status={isMuted ? 'muted' : status} />
        </div>
        
        <h2>AI Voice Agent</h2>
        <p style={{ color:'var(--text-muted)', fontSize:13, marginTop:-12 }}>
          How can I help you today?
        </p>
        <CallStatus status={status} />
        <LastMessage />
        <CallControls 
          onEnd={handleEnd} 
          isMuted={isMuted}
          onMuteToggle={() => {
            const next = !isMuted
            setIsMuted(next)
            mutedRef.current = next
            console.log(next ? '🔇 Muted' : '🔊 Unmuted')
          }}
        />
      </div>
      <TranscriptPanel />
    </div>
  )
}

function LastMessage() {
  const transcript = useCallStore(s => s.transcript)
  const last2 = transcript.slice(-2)
  if (!last2.length) return null
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8,
      width:'100%', maxWidth:400, marginTop:4 }}>
      {last2.map((msg, i) => (
        <div key={i} className="orb-message-bubble" style={{
          background: msg.role==='ai' ? 'var(--surface2)' : 'var(--surface)',
          border:'1px solid var(--border)',
          borderLeft:`2px solid ${msg.role==='ai' ? 'var(--purple)' : 'var(--border)'}`,
          borderRadius:'var(--radius)', padding:'10px 16px',
          fontSize:13, textAlign:'left',
          color: msg.role==='ai' ? 'var(--text)' : 'var(--text-muted)',
          maxHeight: '120px',
          overflowY: 'auto'
        }}>
          <span style={{
            fontSize:10, fontWeight:600, display:'block', marginBottom:4,
            textTransform:'uppercase', letterSpacing:'0.5px',
            color: msg.role==='ai' ? 'var(--purple)' : 'var(--text_muted)'
          }}>
            {msg.role==='ai' ? 'AI Voice Agent' : 'You'}
          </span>
          {msg.text}
        </div>
      ))}
    </div>
  )
}
