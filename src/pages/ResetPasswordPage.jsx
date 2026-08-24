import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../utils/api.js";
import { Field, TextInput } from "../components/ui/Field.jsx";
import { Button } from "../components/ui/Button.jsx";

export function ResetPasswordPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ password: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (form.password.length < 8) errs.password = "Password must be at least 8 characters.";
    else if (!/[A-Za-z]/.test(form.password) || !/[0-9]/.test(form.password)) {
      errs.password = "Password must contain at least one letter and one number.";
    }
    if (form.confirm !== form.password) errs.confirm = "Passwords don't match.";
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await api.resetPassword(token, form.password);
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fieldErrors?.password ? err.fieldErrors : { form: err.message });
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
          <h1 className="text-2xl font-head font-bold text-white mb-1">Set a new password</h1>
          {!done && <p className="text-sm text-slate-400">Choose a new password for your account.</p>}
        </div>

        {done ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4 text-sm text-slate-300">
              Your password has been updated. Any other devices you were logged in on have been signed out.
            </div>
            <Button className="w-full" onClick={() => navigate("/login")}>
              Log in
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <Field label="New password" hint="At least 8 characters, with a letter and a number.">
              <TextInput type="password" value={form.password} onChange={set("password")} autoComplete="new-password" autoFocus />
            </Field>
            {errors.password && <p className="text-xs text-red-400 -mt-3 mb-3">{errors.password}</p>}

            <Field label="Confirm new password">
              <TextInput type="password" value={form.confirm} onChange={set("confirm")} autoComplete="new-password" />
            </Field>
            {errors.confirm && <p className="text-xs text-red-400 -mt-3 mb-3">{errors.confirm}</p>}

            {errors.form && <p className="text-sm text-red-400 mb-4">{errors.form}</p>}

            <Button type="submit" disabled={submitting} className="w-full mt-2">
              {submitting ? "Updating…" : "Update password"}
            </Button>
          </form>
        )}

        <p className="text-center text-sm text-slate-400 mt-6">
          <Link to="/login" className="text-cyan-400 underline hover:text-cyan-300">
            ← Back to log in
          </Link>
        </p>
      </div>
    </main>
  );
}
