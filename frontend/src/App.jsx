import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider }   from './context/ThemeContext'
import { ToastProvider }   from './components/shared/Toast'
import ErrorBoundary       from './components/shared/ErrorBoundary'
import ProtectedRoute      from './components/shared/ProtectedRoute'
import LoginPage           from './pages/LoginPage'
import LandingPage         from './pages/LandingPage'
import CallPage            from './pages/CallPage'
import DashboardPage       from './pages/DashboardPage'
import CallsPage           from './pages/CallsPage'
import ContactsPage        from './pages/ContactsPage'
import KnowledgePage       from './pages/KnowledgePage'
import AnalyticsPage       from './pages/AnalyticsPage'
import SettingsPage        from './pages/SettingsPage'
import UsersPage           from './pages/UsersPage'

const Protected = ({ children, role }) => (
  <ProtectedRoute requiredRole={role}>{children}</ProtectedRoute>
)

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              {/* Public */}
              <Route path="/"      element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />}   />
              <Route path="/bot"   element={<CallPage isPublic={true} />} />

              {/* Protected — any logged-in user */}
              <Route path="/call"      element={<Protected><CallPage /></Protected>} />
              <Route path="/dashboard" element={<Protected><DashboardPage /></Protected>} />
              <Route path="/calls"     element={<Protected><CallsPage /></Protected>} />
              <Route path="/contacts"  element={<Protected><ContactsPage /></Protected>} />
              <Route path="/knowledge" element={<Protected><KnowledgePage /></Protected>} />
              <Route path="/analytics" element={<Protected><AnalyticsPage /></Protected>} />

              {/* Protected — admin only */}
              <Route path="/settings" element={<Protected role="admin"><SettingsPage /></Protected>} />
              <Route path="/users"    element={<Protected role="admin"><UsersPage /></Protected>} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
