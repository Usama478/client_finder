import { useEffect, useState } from "react"
import { useSearchParams, Link } from "react-router"
import { api } from "../../../lib/api"

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [message, setMessage] = useState("")

  useEffect(() => {
    const token = searchParams.get("token")
    if (!token) {
      setStatus("error")
      setMessage("No verification token found in the link.")
      return
    }
    api.verifyEmail(token)
      .then((res) => {
        setStatus("success")
        setMessage(res.message)
      })
      .catch((err) => {
        setStatus("error")
        setMessage(err.message || "Verification failed. The link may have expired.")
      })
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full mx-auto p-8 rounded-xl border border-border bg-card text-center space-y-4">
        {status === "loading" && (
          <p className="text-muted-foreground">Verifying your email...</p>
        )}
        {status === "success" && (
          <>
            <h1 className="text-2xl font-semibold text-foreground">Email Verified</h1>
            <p className="text-muted-foreground">{message}</p>
            <Link
              to="/auth/login"
              className="inline-block mt-4 px-6 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition"
            >
              Go to Login
            </Link>
          </>
        )}
        {status === "error" && (
          <>
            <h1 className="text-2xl font-semibold text-foreground">Verification Failed</h1>
            <p className="text-muted-foreground">{message}</p>
            <Link
              to="/auth/login"
              className="inline-block mt-4 px-6 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition"
            >
              Back to Login
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
