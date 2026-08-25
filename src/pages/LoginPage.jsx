import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore.js";
import { ApiError } from "../utils/api.js";
import { Field, TextInput } from "../components/ui/Field.jsx";
import { Button } from "../components/ui/Button.jsx";

export function LoginPage() {
  const login = useAuthStore((s) => s.login);
  // Explains why someone who was signed in a moment ago is looking at a login
  // form. Without it the app just silently forgets you.
  const sessionExpired = useAuthStore((s) => s.sessionExpired);
  const clearSessionExpired = useAuthStore((s) => s.clearSessionExpired);
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = "Enter a valid email address.";
    if (!form.password) errs.password = "Password is required.";
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await login({ email: form.email.trim(), password: form.password });
      navigate("/editor");
    } catch (err) {
      if (err instanceof ApiError) setErrors({ form: err.message });
      else setErrors({ form: "Something went wrong. Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 text-white font-head font-bold text-lg mb-6">
            <span className="text-xl">🧩</span> Portfolio Builder
          </div>
          <h1 className="text-2xl font-head font-bold text-white mb-1">Welcome back</h1>
          <p className="text-sm text-slate-400">Log in to keep editing your portfolio.</p>
        </div>

        {sessionExpired && (
          <div
            role="status"
            className="flex items-start justify-between gap-3 mb-5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2.5 text-xs text-amber-300"
          >
            <span>Your session ended — please log in again. Any unsaved edits are still in this browser.</span>
            <button
              type="button"
              onClick={clearSessionExpired}
              aria-label="Dismiss"
              className="text-amber-400/70 hover:text-amber-300 shrink-0"
            >
              ✕
            </button>
          </div>
        )}

        <form onSubmit={submit} noValidate>
          <Field label="Email">
            <TextInput type="email" value={form.email} onChange={set("email")} autoComplete="email" />
          </Field>
          {errors.email && <p className="text-xs text-red-400 -mt-3 mb-3">{errors.email}</p>}

          {/* This field sits outside <Field> because of the "Forgot password?"
              link beside its label, which meant the input had no associated
              label at all — axe flagged it critical and a screen reader
              announced an unnamed text box. htmlFor restores the association
              without changing the layout. */}
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="login-password" className="block text-xs font-medium text-slate-400">
              Password
            </label>
            <Link to="/forgot-password" className="text-xs text-cyan-400 underline hover:text-cyan-300">
              Forgot password?
            </Link>
          </div>
          <TextInput
            id="login-password"
            type="password"
            value={form.password}
            onChange={set("password")}
            autoComplete="current-password"
            className="mb-1"
          />
          {errors.password && <p className="text-xs text-red-400 mb-3">{errors.password}</p>}
          {!errors.password && <div className="mb-3" />}

          {errors.form && <p role="alert" className="text-sm text-red-400 mb-4">{errors.form}</p>}

          <Button type="submit" disabled={submitting} className="w-full mt-2">
            {submitting ? "Logging in…" : "Log in"}
          </Button>
        </form>

        <p className="text-center text-sm text-slate-400 mt-6">
          Don't have an account?{" "}
          <Link to="/register" className="text-cyan-400 underline hover:text-cyan-300">
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
}
