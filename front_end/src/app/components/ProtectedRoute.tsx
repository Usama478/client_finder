import { Navigate } from "react-router"
import { useAuth } from "../../lib/auth-context"

export default function ProtectedRoute({ children, requireAdmin }: { children: React.ReactNode; requireAdmin?: boolean }) {
  const { user, loading } = useAuth()
  if (loading) {
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
