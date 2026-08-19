import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/useAuthStore.js";
import { usePortfolioStore } from "../../store/usePortfolioStore.js";
import { api, ApiError } from "../../utils/api.js";
import { Modal } from "../ui/Modal.jsx";
import { Button } from "../ui/Button.jsx";
import { Field, TextInput } from "../ui/Field.jsx";

function Row({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-slate-800 last:border-0">
      <span className="text-xs text-slate-500 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-slate-200 text-right break-all">{children}</span>
    </div>
  );
}

export function AccountModal({ open, onClose }) {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const clearLocalDraft = usePortfolioStore((s) => s.clearLocalDraft);
  const navigate = useNavigate();

  const [view, setView] = useState("details"); // details | password | delete
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [deletePassword, setDeletePassword] = useState("");
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  // Pull fresh details (createdAt, verified state) whenever the modal opens —
  // the locally-cached user object only holds what login/register returned.
  useEffect(() => {
    if (open) {
      refreshUser();
      setView("details");
      setErrors({});
      setNotice("");
      setPwForm({ current: "", next: "", confirm: "" });
      setDeletePassword("");
    }
  }, [open, refreshUser]);

  const signOutAndRedirect = async () => {
    await logout();
    clearLocalDraft();
    onClose();
    navigate("/login");
  };

  const submitPasswordChange = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!pwForm.current) errs.current = "Enter your current password.";
    if (pwForm.next.length < 8) errs.next = "Password must be at least 8 characters.";
    else if (!/[A-Za-z]/.test(pwForm.next) || !/[0-9]/.test(pwForm.next)) {
      errs.next = "Password must contain at least one letter and one number.";
    }
    if (pwForm.confirm !== pwForm.next) errs.confirm = "Passwords don't match.";
    if (Object.keys(errs).length) return setErrors(errs);

    setErrors({});
    setBusy(true);
    try {
      await api.changePassword(token, pwForm.current, pwForm.next);
      // Changing the password revokes every existing session server-side —
      // including this one — so send the user back to log in rather than
      // leaving them holding a token that will 401 on the next request.
      setNotice("Password changed. Signing you out…");
      setTimeout(signOutAndRedirect, 1200);
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors?.currentPassword) setErrors({ current: err.fieldErrors.currentPassword });
      else if (err instanceof ApiError && err.fieldErrors?.newPassword) setErrors({ next: err.fieldErrors.newPassword });
      else setErrors({ form: err.message || "Couldn't change your password." });
      setBusy(false);
    }
  };

  const submitDelete = async (e) => {
    e.preventDefault();
    if (!deletePassword) return setErrors({ delete: "Enter your password to confirm." });
    setErrors({});
    setBusy(true);
    try {
      await api.deleteAccount(token, deletePassword);
      await signOutAndRedirect();
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors?.password) setErrors({ delete: err.fieldErrors.password });
      else setErrors({ delete: err.message || "Couldn't delete your account." });
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <h2 className="text-xl font-head font-bold text-white mb-1">Account</h2>
      <p className="text-sm text-slate-400 mb-5">Your login details and account settings.</p>

      {view === "details" && (
        <>
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-1 mb-5">
            <Row label="Name">{user?.name || "—"}</Row>
            <Row label="Email">{user?.email || "—"}</Row>
            <Row label="Email status">
              {user?.emailVerified ? (
                <span className="text-emerald-400">Verified ✓</span>
              ) : (
                <span className="text-amber-400">Not verified</span>
              )}
            </Row>
            {user?.createdAt && <Row label="Member since">{new Date(user.createdAt.replace(" ", "T") + "Z").toLocaleDateString()}</Row>}
          </div>

          {notice && <p className="text-xs text-cyan-400 mb-3">{notice}</p>}

          <div className="space-y-2">
            {!user?.emailVerified && (
              <Button
                variant="ghost"
                className="w-full"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const { message } = await api.resendVerification(token);
                    setNotice(message);
                  } catch {
                    setNotice("Couldn't send a new link. Please try again.");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Resend verification email
              </Button>
            )}
            <Button variant="ghost" className="w-full" onClick={() => setView("password")}>
              Change password
            </Button>
            <Button variant="ghost" className="w-full" onClick={signOutAndRedirect}>
              Log out
            </Button>
            <button
              type="button"
              onClick={() => setView("delete")}
              className="w-full text-xs text-slate-600 hover:text-red-400 pt-2"
            >
              Delete account
            </button>
          </div>
        </>
      )}

      {view === "password" && (
        <form onSubmit={submitPasswordChange} noValidate>
          <Field label="Current password">
            <TextInput type="password" value={pwForm.current} onChange={(e) => setPwForm((f) => ({ ...f, current: e.target.value }))} autoComplete="current-password" autoFocus />
          </Field>
          {errors.current && <p className="text-xs text-red-400 -mt-3 mb-3">{errors.current}</p>}

          <Field label="New password" hint="At least 8 characters, with a letter and a number.">
            <TextInput type="password" value={pwForm.next} onChange={(e) => setPwForm((f) => ({ ...f, next: e.target.value }))} autoComplete="new-password" />
          </Field>
          {errors.next && <p className="text-xs text-red-400 -mt-3 mb-3">{errors.next}</p>}

          <Field label="Confirm new password">
            <TextInput type="password" value={pwForm.confirm} onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))} autoComplete="new-password" />
          </Field>
          {errors.confirm && <p className="text-xs text-red-400 -mt-3 mb-3">{errors.confirm}</p>}

          {errors.form && <p className="text-sm text-red-400 mb-3">{errors.form}</p>}
          {notice && <p className="text-sm text-cyan-400 mb-3">{notice}</p>}
          <p className="text-[11px] text-slate-500 mb-4">Changing your password signs you out of all devices, including this one.</p>

          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => setView("details")} disabled={busy}>
              Back
            </Button>
            <Button type="submit" className="flex-1" disabled={busy}>
              {busy ? "Updating…" : "Change password"}
            </Button>
          </div>
        </form>
      )}

      {view === "delete" && (
        <form onSubmit={submitDelete} noValidate>
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 mb-4">
            <p className="text-sm text-red-300 font-medium mb-1">This can't be undone.</p>
            <p className="text-xs text-slate-400">
              Your account, your saved portfolio, and your published share link will be permanently deleted. Export your portfolio first if you want a copy.
            </p>
          </div>

          <Field label="Confirm your password">
            <TextInput type="password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} autoComplete="current-password" autoFocus />
          </Field>
          {errors.delete && <p className="text-xs text-red-400 -mt-3 mb-3">{errors.delete}</p>}

          <div className="flex gap-2 mt-2">
            <Button type="button" variant="ghost" onClick={() => setView("details")} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" className="flex-1" disabled={busy}>
              {busy ? "Deleting…" : "Permanently delete account"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
