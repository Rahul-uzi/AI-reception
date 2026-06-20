// src/components/shared/ProtectedRoute.jsx
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

/**
 * Wraps routes that require authentication.
 * Optionally accepts `requiredRole` ("admin" | "manager") for role-gating.
 */
export default function ProtectedRoute({ children, requiredRole }) {
  const token = useAuthStore(s => s.token)
  const user  = useAuthStore(s => s.user)

  if (!token || !user) {
    return <Navigate to="/login" replace />
  }

  if (requiredRole) {
    const roleHierarchy = { admin: 3, manager: 2, viewer: 1 }
    const userLevel     = roleHierarchy[user.role] ?? 0
    const required      = roleHierarchy[requiredRole] ?? 0
    if (userLevel < required) {
      return <Navigate to="/dashboard" replace />
    }
  }

  return children
}
