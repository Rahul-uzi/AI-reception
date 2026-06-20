// src/lib/api.js  — API layer with mock-data fallback
const BASE = import.meta.env.VITE_API_URL || ''

// ── CONFIG ──────────────────────────────────────────────────────
const STRESS_TEST_MODE = false 
const SIMULATE_LATENCY  = false 
const SIMULATE_ERRORS   = false 

// ── Mock data (Clean slate for backend integration) ──────────────
const BASE_MOCK_CALLS = []

function generateStressCalls(count) {
  if (!STRESS_TEST_MODE) return []
  const outcomes = ['Appointment Booked', 'Info Provided', 'Escalated', 'Voicemail']
  const sentiments = ['positive', 'neutral', 'negative']
  return Array.from({ length: count }, (_, i) => ({
    id: `stress-${i}`,
    phone: `+1 (555) ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
    duration: `${Math.floor(Math.random() * 5)}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`,
    outcome: outcomes[Math.floor(Math.random() * outcomes.length)],
    sentiment: sentiments[Math.floor(Math.random() * sentiments.length)],
    status: 'Completed',
    timestamp: Date.now() - Math.floor(Math.random() * 1000 * 60 * 60 * 24 * 7),
    transcript: 'Stress test transcript...',
    summary: 'Automated stress test summary.'
  }))
}

const MOCK_CALLS = STRESS_TEST_MODE ? generateStressCalls(1000) : []

const MOCK_CONTACTS = []
const MOCK_KNOWLEDGE = []

// ── Helpers ──────────────────────────────────────────────────────
async function wait(ms) { return new Promise(r => setTimeout(r, ms)) }

function getToken() {
  try {
    const stored = localStorage.getItem('ai-receptionist-auth')
    return stored ? JSON.parse(stored)?.state?.token : null
  } catch { return null }
}

async function apiFetch(path, opts = {}) {
  if (SIMULATE_LATENCY) await wait(Math.random() * 1000 + 200)
  if (SIMULATE_ERRORS && Math.random() < 0.05) throw new Error('Simulated Architectural Failure')

  const token = getToken()
  const headers = { 'Content-Type': 'application/json', ...opts.headers }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, { ...opts, headers })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// ── Calls ────────────────────────────────────────────────────────
export async function fetchCalls() {
  try { return await apiFetch('/calls') }
  catch (err) { return MOCK_CALLS }
}

export async function fetchCall(id) {
  try { return await apiFetch(`/calls/${id}`) }
  catch { return MOCK_CALLS.find(c => c.id === id) ?? null }
}

export async function deleteCall(id) {
  try { await apiFetch(`/calls/${id}`, { method: 'DELETE' }) }
  catch { /* mock ok */ }
}

// ── Contacts ─────────────────────────────────────────────────────
export async function fetchContacts() {
  try { return await apiFetch('/contacts') }
  catch { return MOCK_CONTACTS }
}

export async function createContact(data) {
  try { return await apiFetch('/contacts', { method: 'POST', body: JSON.stringify(data) }) }
  catch { return { ...data, id: String(Date.now()), calls: 0, lastCall: Date.now() } }
}

export async function updateContact(id, data) {
  try { return await apiFetch(`/contacts/${id}`, { method: 'PUT', body: JSON.stringify(data) }) }
  catch { return { ...data, id } }
}

export async function deleteContact(id) {
  try { await apiFetch(`/contacts/${id}`, { method: 'DELETE' }) }
  catch { /* mock ok */ }
}

// ── Knowledge ────────────────────────────────────────────────────
export async function fetchKnowledge() {
  try { return await apiFetch('/knowledge') }
  catch { return MOCK_KNOWLEDGE }
}

export async function createKnowledgeItem(data) {
  try { return await apiFetch('/knowledge', { method: 'POST', body: JSON.stringify(data) }) }
  catch { return { ...data, id: String(Date.now()), updatedAt: Date.now() } }
}

export async function updateKnowledgeItem(id, data) {
  try { return await apiFetch(`/knowledge/${id}`, { method: 'PUT', body: JSON.stringify(data) }) }
  catch { return { ...data, id } }
}

export async function deleteKnowledgeItem(id) {
  try { await apiFetch(`/knowledge/${id}`, { method: 'DELETE' }) }
  catch { /* mock ok */ }
}

// ── Analytics ────────────────────────────────────────────────────
export async function fetchAnalytics() {
  try { return await apiFetch('/analytics') }
  catch {
    return {
      totalCalls:   MOCK_CALLS.length,
      avgDuration:  '0:00',
      satisfaction: 0,
      resolutionRate: 0,
      byDay: [
        { day: 'Mon', calls: 0, resolved: 0 },
        { day: 'Tue', calls: 0, resolved: 0 },
        { day: 'Wed', calls: 0, resolved: 0 },
        { day: 'Thu', calls: 0, resolved: 0 },
        { day: 'Fri', calls: 0, resolved: 0 },
        { day: 'Sat', calls: 0, resolved: 0 },
        { day: 'Sun', calls: 0, resolved: 0 },
      ],
      byOutcome: [],
      byHour: [],
    }
  }
}

// ── Settings ─────────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  profile: { name: 'Arjun Mehta', email: 'arjun@example.com', role: 'Admin' },
  receptionist: {
    name: 'Aria',
    greeting: "Hello! Thank you for calling. I'm Aria, your AI receptionist. How can I help you today?",
    language: 'en-US',
    voiceSpeed: 1.0,
    voicePitch: 1.0,
  },
  notifications: { email: true, sms: false, callSummary: true, escalation: true },
  integration: { webhookUrl: '', apiKey: '' },
}

export async function fetchSettings() {
  try { return await apiFetch('/settings') }
  catch {
    const stored = localStorage.getItem('ai_receptionist_settings')
    return stored ? JSON.parse(stored) : DEFAULT_SETTINGS
  }
}

export async function saveSettings(data) {
  try { return await apiFetch('/settings', { method: 'PUT', body: JSON.stringify(data) }) }
  catch { localStorage.setItem('ai_receptionist_settings', JSON.stringify(data)); return data }
}
