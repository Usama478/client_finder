import { Navigate } from "react-router"
import { useAuth } from "../../lib/auth-context"

export default function ProtectedRoute({ children, requireAdmin }: { children: React.ReactNode; requireAdmin?: boolean }) {
  const { user, loading } = useAuth()
  
  const hasToken = !!localStorage.getItem("cf_token")

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: "#0a0c10" }}>
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // If user is null but token exists, we might be in a state transition (e.g. right after signup/login)
  // Give it a moment to load by showing the spinner instead of immediately redirecting
  if (!user && hasToken) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: "#0a0c10" }}>
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return <Navigate to="/auth/login" replace />
  if (requireAdmin && !user.is_admin) return <Navigate to="/app" replace />
  return <>{children}</>
}
