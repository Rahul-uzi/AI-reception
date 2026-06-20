// src/components/call/CallControls.jsx
import { useState } from 'react'
import { Mic, MicOff, PhoneOff, Volume2, VolumeX } from 'lucide-react'

export default function CallControls({ onEnd, isMuted, onMuteToggle }) {
  const [speakerOff,    setSpeakerOff]    = useState(false)

  return (
    <div className="call-controls">

      {/* Mute */}
      <button className="ctrl-btn" onClick={onMuteToggle}>
        <div className={`ctrl-icon ${isMuted ? 'muted' : ''}`}>
          {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
        </div>
        <span>{isMuted ? 'Unmute' : 'Mute'}</span>
      </button>

      {/* End Call */}
      <button className="ctrl-btn" onClick={onEnd}>
        <div className="ctrl-icon end-call">
          <PhoneOff size={20} color="#fff" />
        </div>
        <span>End Call</span>
      </button>

      {/* Speaker */}
      <button className="ctrl-btn" onClick={() => setSpeakerOff(s => !s)}>
        <div className="ctrl-icon">
          {speakerOff ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </div>
        <span>Speaker</span>
      </button>

    </div>
  )
}
