import { Link, useNavigate } from "react-router";
import { useState } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { AlertCircle, CheckCircle2, ShieldCheck } from "lucide-react";
import { useAuth } from "../../../lib/auth-context";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/app/simple-search");
    } catch (err: any) {
      setError(err.message || "Invalid email or password");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* LEFT PANEL */}
      <div className="hidden lg:flex w-1/2 bg-muted border-r border-border flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold">CF</div>
          <span className="font-bold text-xl text-foreground">Client Finder</span>
        </div>
        
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-4">Find overseas buyers on autopilot</h1>
          <p className="text-muted-foreground mb-8 text-lg">
            Stop manually searching for leads. Our AI discovers, scores, and verifies 
            B2B clients tailored exactly to your business.
          </p>
          <ul className="space-y-4">
            <li className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
              <span className="text-foreground">AI scores and filters leads so you only see real prospects</span>
            </li>
            <li className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
              <span className="text-foreground">Verify website credibility and extract contact emails automatically</span>
            </li>
            <li className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
              <span className="text-foreground">Generate personalized outreach emails in seconds</span>
            </li>
          </ul>
        </div>
        
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-foreground">Global Exports Ltd</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Match: 94%</span>
              <span className="text-xs bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full font-medium">Verified</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <span>Trust scan complete</span>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <Card className="w-full max-w-md bg-card border-border">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Welcome back</CardTitle>
            <CardDescription>Sign in to your Client Finder account</CardDescription>
          </CardHeader>
          <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link 
                  to="/auth/forgot-password" 
                  className="text-sm text-primary hover:text-primary/80"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>

            <div className="text-center text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link to="/auth/signup" className="text-primary hover:text-primary/80 font-medium">
                Sign up
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
