import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore.js";
import { ApiError } from "../utils/api.js";
import { Field, TextInput } from "../components/ui/Field.jsx";
import { Button } from "../components/ui/Button.jsx";

export function RegisterPage() {
  const register = useAuthStore((s) => s.register);
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = "Name is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = "Enter a valid email address.";
    if (form.password.length < 8) errs.password = "Password must be at least 8 characters.";
    else if (!/[A-Za-z]/.test(form.password) || !/[0-9]/.test(form.password)) {
      errs.password = "Password must contain at least one letter and one number.";
    }
    if (form.confirm !== form.password) errs.confirm = "Passwords don't match.";
    return errs;
  };

  const submit = async (e) => {
    e.preventDefault();
    const clientErrors = validate();
    if (Object.keys(clientErrors).length) {
      setErrors(clientErrors);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await register({ name: form.name.trim(), email: form.email.trim(), password: form.password });
      navigate("/editor");
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fieldErrors?.email ? err.fieldErrors : { form: err.message });
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
          <h1 className="text-2xl font-head font-bold text-white mb-1">Create your account</h1>
          <p className="text-sm text-slate-400">Build and publish your portfolio in minutes.</p>
        </div>

        <form onSubmit={submit} noValidate>
          <Field label="Full name">
            <TextInput value={form.name} onChange={set("name")} autoComplete="name" />
          </Field>
          {errors.name && <p className="text-xs text-red-400 -mt-3 mb-3">{errors.name}</p>}

          <Field label="Email">
            <TextInput type="email" value={form.email} onChange={set("email")} autoComplete="email" />
          </Field>
          {errors.email && <p className="text-xs text-red-400 -mt-3 mb-3">{errors.email}</p>}

          <Field label="Password" hint="At least 8 characters, with a letter and a number.">
            <TextInput type="password" value={form.password} onChange={set("password")} autoComplete="new-password" />
          </Field>
          {errors.password && <p className="text-xs text-red-400 -mt-3 mb-3">{errors.password}</p>}

          <Field label="Confirm password">
            <TextInput type="password" value={form.confirm} onChange={set("confirm")} autoComplete="new-password" />
          </Field>
          {errors.confirm && <p className="text-xs text-red-400 -mt-3 mb-3">{errors.confirm}</p>}

          {errors.form && <p role="alert" className="text-sm text-red-400 mb-4">{errors.form}</p>}

          <Button type="submit" disabled={submitting} className="w-full mt-2">
            {submitting ? "Creating account…" : "Create account"}
          </Button>
        </form>

        <p className="text-center text-sm text-slate-400 mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-cyan-400 underline hover:text-cyan-300">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
