import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { AuthShell } from "../../components/auth/AuthShell";
import { StatusNotice } from "../../components/page/StatusNotice";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitted(true);
  };

  return (
    <AuthShell
      eyebrow="Password recovery"
      title="Reset access when the auth backend lands"
      description="This route gives the product a complete recovery surface now, while making the missing backend step explicit."
      footer={(
        <>
          Remembered it?{" "}
          <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-300">
            Back to login
          </Link>
        </>
      )}
      helper={(
        <StatusNotice
          title="Recovery flow is staged"
          description="Password reset emails are not being sent yet. This page is here so the auth journey feels complete during migration."
        />
      )}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="forgot-email"
            className="mb-2 block text-sm font-medium text-gray-700 dark:text-zinc-300"
          >
            Account email
          </label>
          <Input
            id="forgot-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@workspace.com"
            required
            className="h-11"
          />
        </div>

        {isSubmitted ? (
          <StatusNotice
            tone="info"
            title="Reset request captured"
            description={`A future backend integration will send the password reset link to ${email}. No email was sent in this frontend-only phase.`}
          />
        ) : null}

        <div className="space-y-3 pt-2">
          <Button type="submit" className="h-11 w-full">
            Send reset link
          </Button>
          <Button type="button" variant="outline" className="h-11 w-full" asChild>
            <Link to="/signup">Create a new account instead</Link>
          </Button>
        </div>
      </form>
    </AuthShell>
  );
}
