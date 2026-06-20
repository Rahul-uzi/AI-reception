// src/store/authStore.js — Zustand auth store with token persistence
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const BASE = import.meta.env.VITE_API_URL || ''

export const useAuthStore = create(
  persist(
    (set, get) => ({
      token: null,
      user:  null,

      // Login
      login: async (email, password) => {
        const res = await fetch(`${BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.detail || 'Login failed')
        }
        const data = await res.json()
        set({ token: data.token, user: data.user })
        return data.user
      },

      // Logout
      logout: () => set({ token: null, user: null }),

      // Refresh current user profile
      refreshMe: async () => {
        const { token } = get()
        if (!token) return
        const res = await fetch(`${BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (!res.ok) { set({ token: null, user: null }); return }
        const user = await res.json()
        set({ user })
        return user
      },

      // Update own profile
      updateProfile: async (fields) => {
        const { token } = get()
        const res = await fetch(`${BASE}/auth/me`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(fields)
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.detail || 'Update failed')
        }
        const user = await res.json()
        set({ user })
        return user
      },

      // Role helpers
      isAdmin:   () => get().user?.role === 'admin',
      isManager: () => ['admin','manager'].includes(get().user?.role),
      isViewer:  () => !!get().user,
    }),
    { name: 'ai-receptionist-auth', partialize: (s) => ({ token: s.token, user: s.user }) }
  )
)
