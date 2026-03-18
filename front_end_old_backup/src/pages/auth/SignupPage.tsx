import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { AuthShell } from "../../components/auth/AuthShell";
import { StatusNotice } from "../../components/page/StatusNotice";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";

export function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(true);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitted(true);
  };

  return (
    <AuthShell
      eyebrow="Create your account"
      title="Start a new Client Finder workspace"
      description="Set up the account shell now so onboarding, billing, and auth integrations can slot in cleanly later."
      footer={(
        <>
          Already have access?{" "}
          <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-300">
            Log in
          </Link>
        </>
      )}
      helper={(
        <StatusNotice
          title="Frontend-first signup"
          description="Account creation is not connected to the backend yet, but the form structure is ready for the real contract."
        />
      )}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="signup-name"
              className="mb-2 block text-sm font-medium text-gray-700 dark:text-zinc-300"
            >
              Full name
            </label>
            <Input
              id="signup-name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Usama Khan"
              required
              className="h-11"
            />
          </div>
          <div>
            <label
              htmlFor="signup-workspace"
              className="mb-2 block text-sm font-medium text-gray-700 dark:text-zinc-300"
            >
              Workspace name
            </label>
            <Input
              id="signup-workspace"
              value={workspaceName}
              onChange={(event) => setWorkspaceName(event.target.value)}
              placeholder="Client Finder Studio"
              required
              className="h-11"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="signup-email"
            className="mb-2 block text-sm font-medium text-gray-700 dark:text-zinc-300"
          >
            Work email
          </label>
          <Input
            id="signup-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="founder@workspace.com"
            required
            className="h-11"
          />
        </div>

        <div>
          <label
            htmlFor="signup-password"
            className="mb-2 block text-sm font-medium text-gray-700 dark:text-zinc-300"
          >
            Password
          </label>
          <Input
            id="signup-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Create a secure password"
            required
            className="h-11"
          />
        </div>

        <label className="flex items-start gap-3 rounded-xl border border-gray-200 px-3 py-3 text-sm text-gray-600 dark:border-zinc-800 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={agreedToTerms}
            onChange={(event) => setAgreedToTerms(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300"
          />
          <span>
            I agree to the product terms and understand this workspace signup is
            currently a staged frontend flow.
          </span>
        </label>

        {isSubmitted ? (
          <StatusNotice
            tone="success"
            title="Workspace draft captured"
            description={`Prepared the signup payload for ${workspaceName}. The real account creation request will be added when auth services are ready.`}
          />
        ) : null}

        <div className="space-y-3 pt-2">
          <Button type="submit" className="h-11 w-full" disabled={!agreedToTerms}>
            Create workspace
          </Button>
          <Button type="button" variant="outline" className="h-11 w-full" asChild>
            <Link to="/dashboard">Preview the app shell</Link>
          </Button>
        </div>
      </form>
    </AuthShell>
  );
}
