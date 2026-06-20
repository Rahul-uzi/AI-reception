import { create } from 'zustand'

export const useCallStore = create((set) => ({
  status:     'idle',
  transcript: [],
  duration:   0,

  setStatus:  (s)   => set({ status: s }),
  addMessage: (msg) => set((st) => ({ transcript: [...st.transcript, msg] })),
  reset:      ()    => set({ status: 'idle', transcript: [], duration: 0 }),
}))
