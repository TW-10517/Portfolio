import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../utils/api.js";
import { Field, TextInput } from "../components/ui/Field.jsx";
import { Button } from "../components/ui/Button.jsx";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await api.forgotPassword(email.trim());
      setSent(true);
    } catch {
      // The endpoint always responds generically, so this only fires for
      // actual network/server failures — show it, but don't reveal anything
      // about whether the account exists.
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 text-white font-head font-bold text-lg mb-6">
            <span className="text-xl">🧩</span> Portfolio Builder
          </div>
          <h1 className="text-2xl font-head font-bold text-white mb-1">Reset your password</h1>
          <p className="text-sm text-slate-400">We'll send a reset link to your email.</p>
        </div>

        {sent ? (
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4 text-sm text-slate-300">
            If an account exists for <span className="text-white">{email.trim()}</span>, we've sent password reset instructions.
            <p className="text-xs text-slate-500 mt-2">
              No email provider is configured for this app — check the API server's console output for the reset link.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <Field label="Email">
              <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoFocus />
            </Field>
            {error && <p className="text-sm text-red-400 mb-4">{error}</p>}
            <Button type="submit" disabled={submitting} className="w-full mt-2">
              {submitting ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        )}

        <p className="text-center text-sm text-slate-500 mt-6">
          <Link to="/login" className="text-cyan-400 hover:text-cyan-300">
            ← Back to log in
          </Link>
        </p>
      </div>
    </div>
  );
}
