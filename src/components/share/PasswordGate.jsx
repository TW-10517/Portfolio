import { useState } from "react";

// `onUnlock(password)` must return a Promise that resolves on success or
// rejects (with a message) on failure — the actual check happens server-side.
export function PasswordGate({ onUnlock, name }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setChecking(true);
    setError("");
    try {
      await onUnlock(value);
    } catch (err) {
      setError(err?.message || "Incorrect password. Try again.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <form onSubmit={submit} className="w-full max-w-sm text-center">
        <div className="text-4xl mb-4">🔒</div>
        <h1 className="text-white font-head text-xl font-semibold mb-2">{name ? `${name}'s portfolio is protected` : "This portfolio is protected"}</h1>
        <p className="text-slate-400 text-sm mb-6">Enter the password to view it.</p>
        <input
          type="password"
          autoFocus
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError("");
          }}
          className="w-full rounded-lg bg-slate-900 border border-slate-700 px-4 py-3 text-center text-slate-100 focus:outline-none focus:border-cyan-400 mb-3"
          placeholder="Password"
        />
        {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
        <button
          type="submit"
          disabled={checking}
          className="w-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 text-slate-950 font-semibold py-3 disabled:opacity-50"
        >
          {checking ? "Checking…" : "Unlock"}
        </button>
      </form>
    </div>
  );
}
