import { Link } from "react-router";
import { useState } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { CheckCircle, ArrowLeft } from "lucide-react";
import { api } from "../../../lib/api";

const LeftPanel = () => (
  <div className="hidden lg:flex w-1/2 bg-muted border-r border-border flex-col justify-between p-12 relative overflow-hidden">
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
          Recover your{" "}
          <span className="bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            account
          </span>
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed mb-8 max-w-xs">
          Enter your registered email and we'll send a secure reset link. Takes less than 30 seconds.
        </p>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-7 h-7 rounded-full bg-blue-500/15 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
            <CheckCircle className="h-3.5 w-3.5 text-blue-400" />
          </div>
          <span className="text-sm text-foreground/80">Secure link expires in 15 minutes</span>
        </div>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-7 h-7 rounded-full bg-blue-500/15 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
            <CheckCircle className="h-3.5 w-3.5 text-blue-400" />
          </div>
          <span className="text-sm text-foreground/80">No account? Sign up instead</span>
        </div>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-7 h-7 rounded-full bg-blue-500/15 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
            <CheckCircle className="h-3.5 w-3.5 text-blue-400" />
          </div>
          <span className="text-sm text-foreground/80">Check spam if email doesn't arrive</span>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card/80 backdrop-blur-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          <span className="text-xs font-semibold text-foreground">Security Notice</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Reset links are single-use and expire in 15 minutes. If you didn't request this, your account is still safe — simply ignore the email.
        </p>
      </div>
    </div>
  </div>
);

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await api.forgotPassword(email);
      setSubmitted(true);
    } catch (err: any) {
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex">
        <LeftPanel />
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background">
          <div className="w-full max-w-sm">
            <Card className="bg-card border border-border shadow-2xl shadow-black/10">
              <CardHeader className="text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="h-8 w-8 text-emerald-400" />
                </div>
                <CardTitle className="font-['Syne']">Check your email</CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  We sent a reset link to{" "}
                  <strong className="text-foreground font-medium">{email}</strong>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-border bg-muted p-4 text-sm text-muted-foreground leading-relaxed">
                  If you don't see the email, check your spam folder or{" "}
                  <button
                    onClick={() => setSubmitted(false)}
                    className="text-blue-400 hover:text-blue-300 font-medium"
                  >
                    try another email address
                  </button>
                </div>

                <div
                  className="w-full h-11 rounded-lg border border-border bg-transparent hover:bg-muted text-foreground text-sm font-medium flex items-center justify-center gap-2 cursor-pointer transition-all mt-2"
                >
                  <Link to="/auth/login" className="flex items-center gap-2 w-full justify-center">
                    <ArrowLeft className="h-4 w-4" />
                    Back to login
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

          <Card className="bg-card border border-border shadow-2xl shadow-black/10">
            <CardHeader className="text-center">
              <CardTitle className="font-['Syne'] text-xl">Reset your password</CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                Enter your email and we'll send you a reset link
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-input border-border focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 text-foreground placeholder:text-muted-foreground/50"
                  />
                </div>

                <div
                  onClick={loading ? undefined : handleSubmit}
                  className={`w-full h-11 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white text-sm font-medium flex items-center justify-center cursor-pointer transition-all${loading ? " pointer-events-none opacity-60" : ""}`}
                >
                  {loading ? "Sending..." : "Send reset link →"}
                </div>

                <Link to="/auth/login">
                  <Button variant="ghost" className="w-full text-muted-foreground hover:text-foreground text-sm mt-1">
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
