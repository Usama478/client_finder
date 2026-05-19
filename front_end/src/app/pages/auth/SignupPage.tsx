import { Link, useNavigate } from "react-router";
import { useState } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Checkbox } from "../../components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { AlertCircle, CheckCircle2, ShieldCheck } from "lucide-react";
import { useAuth } from "../../../lib/auth-context";

export default function SignupPage() {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    company: "",
    termsAccepted: false
  });
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (!formData.termsAccepted) {
      setError("Please accept the terms and conditions");
      return;
    }
    setLoading(true);
    try {
      const message = await signup(formData.fullName, formData.email, formData.password);
      setSuccessMessage(message);
    } catch (err: any) {
      setError(err.message || "Signup failed. Please try again.");
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (successMessage) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-card">
          <CardHeader className="text-center">
            <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center text-white font-bold text-xl mx-auto mb-4">
              ✓
            </div>
            <CardTitle className="text-2xl">Check Your Email</CardTitle>
            <CardDescription>{successMessage}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/auth/login">
              <Button className="w-full">Go to Login</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* LEFT PANEL */}
      <div className="hidden lg:flex w-1/2 bg-muted border-r border-border flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold">CF</div>
          <span className="font-bold text-xl text-foreground">Client Finder</span>
        </div>
        
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-4">Start finding buyers in minutes</h1>
          <p className="text-muted-foreground mb-8 text-lg">
            Join today and get a 14-day free trial. No credit card required. Experience the full power of automated B2B client discovery.
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
            <CardTitle className="text-2xl">Create your account</CardTitle>
            <CardDescription>Start your 14-day free trial, no credit card required</CardDescription>
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
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="John Doe"
                value={formData.fullName}
                onChange={(e) => handleChange("fullName", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Work Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company">Company Name (optional)</Label>
              <Input
                id="company"
                type="text"
                placeholder="Your Company Inc."
                value={formData.company}
                onChange={(e) => handleChange("company", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => handleChange("password", e.target.value)}
                required
              />
            </div>
            {formData.password.length > 0 && (() => {
              const p = formData.password;
              let score = 1;
              if (p.length >= 6) score = 2;
              if (p.length >= 8) score = 3;
              if (p.length >= 8 && /[A-Z]/.test(p) && /\d/.test(p)) score = 4;
              const labels = ["", "Weak", "Fair", "Good", "Strong"];
              const colors = ["", "bg-red-500", "bg-amber-400", "bg-amber-400", "bg-green-500"];
              const textColors = ["", "text-red-400", "text-amber-400", "text-amber-400", "text-green-400"];
              return (
                <div className="mt-1.5 space-y-1">
                  <div className="flex gap-1">
                    {[1,2,3,4].map(i => (
                      <div key={i} className={`h-1 flex-1 rounded-full ${i <= score ? colors[score] : "bg-muted"}`} />
                    ))}
                  </div>
                  <p className={`text-xs ${textColors[score]}`}>{labels[score]}</p>
                </div>
              );
            })()}

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => handleChange("confirmPassword", e.target.value)}
                required
              />
            </div>

            <div className="flex items-start space-x-2">
              <Checkbox
                id="terms"
                checked={formData.termsAccepted}
                onCheckedChange={(checked) => handleChange("termsAccepted", checked as boolean)}
              />
              <label
                htmlFor="terms"
                className="text-sm text-muted-foreground leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                I agree to the{" "}
                <a href="#" className="text-primary hover:text-primary/80">
                  Terms of Service
                </a>{" "}
                and{" "}
                <a href="#" className="text-primary hover:text-primary/80">
                  Privacy Policy
                </a>
              </label>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account..." : "Create account"}
            </Button>

            <div className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/auth/login" className="text-primary hover:text-primary/80 font-medium">
                Sign in
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
