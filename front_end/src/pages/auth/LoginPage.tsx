import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { AuthShell } from "../../components/auth/AuthShell";
import { StatusNotice } from "../../components/page/StatusNotice";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitted(true);
  };

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Log in to your workspace"
      description="Access the search, validation, and client management surfaces already migrated into the app shell."
      footer={(
        <>
          Need an account?{" "}
          <Link to="/signup" className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-300">
            Create one
          </Link>
        </>
      )}
      helper={(
        <StatusNotice
          title="Backend-safe auth stub"
          description="Login wiring is intentionally deferred until the auth backend is ready. This screen is UI-complete and safe to integrate later."
        />
      )}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="login-email"
            className="mb-2 block text-sm font-medium text-gray-700 dark:text-zinc-300"
          >
            Work email
          </label>
          <Input
            id="login-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@workspace.com"
            required
            className="h-11"
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <label
              htmlFor="login-password"
              className="block text-sm font-medium text-gray-700 dark:text-zinc-300"
            >
              Password
            </label>
            <Link
              to="/forgot-password"
              className="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-300"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="login-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            required
            className="h-11"
          />
        </div>

        <label className="flex items-center gap-3 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-600 dark:border-zinc-800 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(event) => setRememberMe(event.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
          Keep me signed in on this device
        </label>

        {isSubmitted ? (
          <StatusNotice
            tone="success"
            title="Ready for backend hookup"
            description={`Captured sign-in attempt for ${email}. No request was sent because authentication is still being migrated.`}
          />
        ) : null}

        <div className="space-y-3 pt-2">
          <Button type="submit" className="h-11 w-full">
            Log In
          </Button>
          <Button type="button" variant="outline" className="h-11 w-full" asChild>
            <Link to="/dashboard">Explore the product</Link>
          </Button>
        </div>
      </form>
    </AuthShell>
  );
}
