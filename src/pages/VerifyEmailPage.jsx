import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../utils/api.js";
import { useAuthStore } from "../store/useAuthStore.js";
import { Button } from "../components/ui/Button.jsx";

export function VerifyEmailPage() {
  const { token } = useParams();
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const [status, setStatus] = useState("verifying"); // verifying | done | error
  const [error, setError] = useState("");
  // Verification tokens are single-use: without this guard, React 18
  // StrictMode's dev-only double-invoke of effects fires this POST twice,
  // and the second (losing) request gets a spurious "invalid token" error
  // even though the first one already succeeded. A ref survives the
  // mount→cleanup→mount cycle, so the real request only ever fires once —
  // which also means there's no second, fresher request that could race
  // with a stale one, so (unlike most effects) we deliberately don't need
  // an `if (cancelled) return` guard in the .then()/.catch() below: adding
  // one would only reintroduce a bug, since StrictMode's mandatory cleanup
  // between the two invocations would flip it before the one real request
  // resolves, silently swallowing this component's only state update.
  const requestedRef = useRef(false);

  useEffect(() => {
    if (requestedRef.current) return;
    requestedRef.current = true;

    api
      .verifyEmail(token)
      .then(async () => {
        await refreshUser(); // picks up emailVerified:true if already logged in
        setStatus("done");
      })
      .catch((err) => {
        setError(err.message || "This verification link is invalid or has expired.");
        setStatus("error");
      });
  }, [token, refreshUser]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm text-center">
        <div className="inline-flex items-center gap-2 text-white font-head font-bold text-lg mb-6">
          <span className="text-xl">🧩</span> Portfolio Builder
        </div>

        {status === "verifying" && <p className="text-sm text-slate-400">Verifying your email…</p>}

        {status === "done" && (
          <>
            <h1 className="text-2xl font-head font-bold text-white mb-2">Email verified ✓</h1>
            <p className="text-sm text-slate-400 mb-6">Your email address has been confirmed.</p>
            <Button onClick={() => window.location.assign("#/editor")}>Go to editor</Button>
          </>
        )}

        {status === "error" && (
          <>
            <h1 className="text-2xl font-head font-bold text-white mb-2">Verification failed</h1>
            <p className="text-sm text-red-400 mb-6">{error}</p>
            <Link to="/editor" className="text-cyan-400 underline hover:text-cyan-300 text-sm">
              ← Back to editor
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
