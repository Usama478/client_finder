import { Link, useSearchParams, useNavigate } from "react-router";
import { useState } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { CheckCircle, ArrowLeft, AlertCircle } from "lucide-react";
import { api } from "../../../lib/api";

const LeftPanel = () => (
  <div className="hidden lg:flex w-1/2 bg-[#080a0d] border-r border-[rgba(255,255,255,0.06)] flex-col justify-between p-12 relative overflow-hidden">
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
      <svg
        width={500}
        height={500}
        viewBox="0 0 500 500"
        style={{ animation: "spin 20s linear infinite", transformOrigin: "250px 250px" }}
      >
        <circle cx={250} cy={250} r={50} stroke="rgba(59,130,246,0.07)" strokeWidth={1} fill="none" />
        <circle cx={250} cy={250} r={100} stroke="rgba(59,130,246,0.07)" strokeWidth={1} fill="none" />
        <circle cx={250} cy={250} r={150} stroke="rgba(59,130,246,0.07)" strokeWidth={1} fill="none" />
        <circle cx={250} cy={250} r={200} stroke="rgba(59,130,246,0.07)" strokeWidth={1} fill="none" />
        <circle cx={250} cy={250} r={240} stroke="rgba(59,130,246,0.07)" strokeWidth={1} fill="none" />
        <line x1={250} y1={250} x2={490} y2={10} stroke="rgba(59,130,246,0.25)" strokeWidth={1} />
        <circle cx={380} cy={120} r={4} fill="#f59e0b" opacity={0.8} />
        <circle cx={320} cy={200} r={3} fill="#10b981" opacity={0.9} />
        <circle cx={180} cy={310} r={3} fill="#3b82f6" opacity={0.7} />
      </svg>
    </div>

    <div className="relative z-10 flex flex-col justify-between h-full">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-500 rounded-lg flex items-center justify-center text-white font-bold font-['Syne'] text-sm relative">
          CF
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-pulse border border-[#080a0d]" />
        </div>
        <span className="font-bold text-lg text-foreground font-['Syne']">Client Finder</span>
      </div>

      <div>
        <h2 className="text-3xl font-bold font-['Syne'] text-foreground mb-4 leading-tight">
          Create a new{" "}
          <span className="bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            password
          </span>
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed mb-8 max-w-xs">
          Choose a strong password to secure your account. You'll use it next time you sign in.
        </p>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-7 h-7 rounded-full bg-blue-500/15 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
            <CheckCircle className="h-3.5 w-3.5 text-blue-400" />
          </div>
          <span className="text-sm text-foreground/80">Use at least 8 characters</span>
        </div>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-7 h-7 rounded-full bg-blue-500/15 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
            <CheckCircle className="h-3.5 w-3.5 text-blue-400" />
          </div>
          <span className="text-sm text-foreground/80">Mix letters, numbers and symbols</span>
        </div>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-7 h-7 rounded-full bg-blue-500/15 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
            <CheckCircle className="h-3.5 w-3.5 text-blue-400" />
          </div>
          <span className="text-sm text-foreground/80">This link is single-use and expires soon</span>
        </div>
      </div>

      <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0f1218]/80 backdrop-blur-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          <span className="text-xs font-semibold text-foreground">Security Notice</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          After resetting, all active sessions will remain unless you sign out manually. Use a unique password you don't use elsewhere.
        </p>
      </div>
    </div>
  </div>
);

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!token) {
      setError("Invalid or missing reset token");
      return;
    }

    setLoading(true);
    try {
      await api.resetPassword(token, password);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Failed to reset password. Token may be invalid or expired.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex">
        <LeftPanel />
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background">
          <div className="w-full max-w-sm">
            <Card className="bg-[#0f1218] border border-[rgba(255,255,255,0.08)] shadow-2xl shadow-black/50">
              <CardHeader className="text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="h-8 w-8 text-emerald-400" />
                </div>
                <CardTitle className="font-['Syne']">Password reset successful</CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  Your password has been updated. You can now log in with your new password.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="w-full h-11 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white text-sm font-medium flex items-center justify-center cursor-pointer transition-all">
                  <Link to="/auth/login" className="w-full text-center">
                    Continue to login
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <LeftPanel />
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-sm">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-500 rounded-xl flex items-center justify-center text-white font-bold font-['Syne'] text-sm mb-6 mx-auto">
            CF
          </div>

          <Card className="bg-[#0f1218] border border-[rgba(255,255,255,0.08)] shadow-2xl shadow-black/50">
            <CardHeader className="text-center">
              <CardTitle className="font-['Syne'] text-xl">Create new password</CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                Enter your new password below
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 flex items-start gap-2 text-sm text-red-400">
                    <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="password">New password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter new password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className="bg-[#151a22] border-[rgba(255,255,255,0.08)] focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 text-foreground placeholder:text-muted-foreground/50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    className="bg-[#151a22] border-[rgba(255,255,255,0.08)] focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 text-foreground placeholder:text-muted-foreground/50"
                  />
                </div>

                <div
                  onClick={loading ? undefined : handleSubmit}
                  className={`w-full h-11 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white text-sm font-medium flex items-center justify-center cursor-pointer transition-all${loading ? " pointer-events-none opacity-60" : ""}`}
                >
                  {loading ? "Resetting..." : "Reset password →"}
                </div>

                <Link to="/auth/login">
                  <Button variant="ghost" className="w-full text-muted-foreground hover:text-foreground text-sm mt-1">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to login
                  </Button>
                </Link>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
