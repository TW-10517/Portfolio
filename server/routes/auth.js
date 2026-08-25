import { Router } from "express";
import { sql, nowIso } from "../db.js";
import { forgetUsersImages } from "../imageGc.js";
import { deliverLink } from "../mail.js";
import {
  validateRegistration,
  validateLogin,
  validatePasswordReset,
  hashPassword,
  verifyPassword,
  signToken,
  requireAuth,
  generateRawToken,
  hashToken,
  isTokenExpired,
  EMAIL_RE,
} from "../auth.js";
import { loginLimiter, registerLimiter, tokenLimiter } from "../rateLimit.js";

export const authRouter = Router();

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Delivery is configuration, not code: MAIL_TRANSPORT=console (the default)
// logs the link, MAIL_TRANSPORT=smtp sends it. See server/mail.js.
//
// Not awaited anywhere below. Sending is slow and its failure is not the
// caller's problem — an account exists whether or not the mail server is
// reachable, and "resend verification" covers the rest.

authRouter.post("/register", registerLimiter, async (req, res) => {
  const { name, email, password } = req.body || {};
  const errors = validateRegistration({ name, email, password });
  if (Object.keys(errors).length) return res.status(400).json({ errors });

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await sql.get("SELECT id FROM users WHERE email = ?", [normalizedEmail]);
  if (existing) return res.status(409).json({ errors: { email: "An account with this email already exists." } });

  const password_hash = await hashPassword(password);
  const rawVerifyToken = generateRawToken();
  const verifyExpires = new Date(Date.now() + VERIFY_TOKEN_TTL_MS).toISOString();

  const info = await sql.insert(
    "INSERT INTO users (email, password_hash, name, verify_token_hash, verify_token_expires, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    [normalizedEmail, password_hash, name.trim(), hashToken(rawVerifyToken), verifyExpires, nowIso()]
  );

  deliverLink("Email verification", normalizedEmail, `${FRONTEND_URL}/#/verify-email/${rawVerifyToken}`);

  const user = { id: info.id, email: normalizedEmail, name: name.trim(), token_version: 0 };
  const token = signToken(user);
  res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name, emailVerified: false } });
});

authRouter.post("/login", loginLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  const errors = validateLogin({ email, password });
  if (Object.keys(errors).length) return res.status(400).json({ errors });

  const normalizedEmail = email.trim().toLowerCase();
  const row = await sql.get("SELECT * FROM users WHERE email = ?", [normalizedEmail]);
  const genericError = { errors: { form: "Incorrect email or password." } };
  if (!row) return res.status(401).json(genericError);

  const valid = await verifyPassword(password, row.password_hash);
  if (!valid) return res.status(401).json(genericError);

  const token = signToken(row);
  res.json({ token, user: { id: row.id, email: row.email, name: row.name, emailVerified: !!row.email_verified } });
});

authRouter.post("/logout", requireAuth, async (req, res) => {
  // Bumping token_version invalidates every token issued before this call —
  // this token included — for this user, since requireAuth compares the
  // token's embedded version against the current DB value on every request.
  await sql.run("UPDATE users SET token_version = token_version + 1 WHERE id = ?", [req.user.sub]);
  res.status(204).end();
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const row = await sql.get("SELECT id, email, name, email_verified, created_at FROM users WHERE id = ?", [req.user.sub]);
  if (!row) return res.status(404).json({ error: "User not found." });
  res.json({ user: { id: row.id, email: row.email, name: row.name, emailVerified: !!row.email_verified, createdAt: row.created_at } });
});

// Always responds the same way whether or not the email exists, so this
// endpoint can't be used to enumerate registered accounts.
authRouter.post("/forgot-password", tokenLimiter, async (req, res) => {
  const { email } = req.body || {};
  const generic = { message: "If an account exists for that email, we've sent password reset instructions." };
  if (!email || !EMAIL_RE.test(email)) return res.json(generic);

  const normalizedEmail = email.trim().toLowerCase();
  const row = await sql.get("SELECT id, email FROM users WHERE email = ?", [normalizedEmail]);
  if (row) {
    const rawToken = generateRawToken();
    const expires = new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString();
    await sql.run("UPDATE users SET reset_token_hash = ?, reset_token_expires = ? WHERE id = ?", [hashToken(rawToken), expires, row.id]);
    deliverLink("Password reset", row.email, `${FRONTEND_URL}/#/reset-password/${rawToken}`);
  }
  res.json(generic);
});

authRouter.post("/reset-password", tokenLimiter, async (req, res) => {
  const { token, password } = req.body || {};
  if (!token) return res.status(400).json({ error: "Missing reset token." });

  const errors = validatePasswordReset({ password });
  if (Object.keys(errors).length) return res.status(400).json({ errors });

  const tokenHash = hashToken(token);
  const row = await sql.get("SELECT id, reset_token_expires FROM users WHERE reset_token_hash = ?", [tokenHash]);
  if (!row || isTokenExpired(row.reset_token_expires)) {
    return res.status(400).json({ error: "This reset link is invalid or has expired. Request a new one." });
  }

  const password_hash = await hashPassword(password);
  await sql.run(
    "UPDATE users SET password_hash = ?, reset_token_hash = NULL, reset_token_expires = NULL, token_version = token_version + 1 WHERE id = ?",
    [password_hash, row.id]
  );

  res.json({ message: "Password updated. You can now log in with your new password." });
});

// Permanently deletes the account and everything attached to it. Requires
// the current password, since this is irreversible and a hijacked session
// shouldn't be able to destroy someone's data. The portfolios row goes with
// it via ON DELETE CASCADE, which also frees up the slug.
authRouter.delete("/me", requireAuth, async (req, res) => {
  const { password } = req.body || {};
  const row = await sql.get("SELECT * FROM users WHERE id = ?", [req.user.sub]);
  if (!row) return res.status(404).json({ error: "User not found." });

  const valid = !!password && (await verifyPassword(password, row.password_hash));
  if (!valid) return res.status(401).json({ errors: { password: "Incorrect password." } });

  // SQLite only enforces ON DELETE CASCADE when foreign keys are switched on
  // (it's off by default per-connection), so delete the child row explicitly
  // rather than relying on it and silently orphaning portfolios.
  await sql.run("DELETE FROM portfolios WHERE user_id = ?", [row.id]);
  // Their uploaded pictures too — a delete that leaves someone's photograph
  // on the server, still downloadable by anyone with the link, is not a
  // delete. Bytes shared with another account survive; the claim doesn't.
  await forgetUsersImages(row.id);
  await sql.run("DELETE FROM users WHERE id = ?", [row.id]);
  res.status(204).end();
});

// Changing your password while signed in. Requires the current password
// (so a hijacked session can't lock the real owner out) and, like a reset,
// invalidates every previously-issued token — including the one used to
// make this request, so the client must log in again afterwards.
authRouter.post("/change-password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const row = await sql.get("SELECT * FROM users WHERE id = ?", [req.user.sub]);
  if (!row) return res.status(404).json({ error: "User not found." });

  const valid = !!currentPassword && (await verifyPassword(currentPassword, row.password_hash));
  if (!valid) return res.status(401).json({ errors: { currentPassword: "That's not your current password." } });

  const errors = validatePasswordReset({ password: newPassword });
  if (Object.keys(errors).length) return res.status(400).json({ errors: { newPassword: errors.password } });

  const password_hash = await hashPassword(newPassword);
  await sql.run("UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?", [password_hash, row.id]);
  res.json({ message: "Password changed. Please log in again." });
});

// Issues a fresh verification link (the original expires after 24h).
authRouter.post("/resend-verification", requireAuth, tokenLimiter, async (req, res) => {
  const row = await sql.get("SELECT id, email, email_verified FROM users WHERE id = ?", [req.user.sub]);
  if (!row) return res.status(404).json({ error: "User not found." });
  if (row.email_verified) return res.json({ message: "Your email is already verified." });

  const rawToken = generateRawToken();
  const expires = new Date(Date.now() + VERIFY_TOKEN_TTL_MS).toISOString();
  await sql.run("UPDATE users SET verify_token_hash = ?, verify_token_expires = ? WHERE id = ?", [hashToken(rawToken), expires, row.id]);
  deliverLink("Email verification", row.email, `${FRONTEND_URL}/#/verify-email/${rawToken}`);
  res.json({ message: "A new verification link has been sent." });
});

authRouter.post("/verify-email", tokenLimiter, async (req, res) => {
  const { token } = req.body || {};
  if (!token) return res.status(400).json({ error: "Missing verification token." });

  const tokenHash = hashToken(token);
  const row = await sql.get("SELECT id, verify_token_expires FROM users WHERE verify_token_hash = ?", [tokenHash]);
  if (!row || isTokenExpired(row.verify_token_expires)) {
    return res.status(400).json({ error: "This verification link is invalid or has expired." });
  }

  await sql.run("UPDATE users SET email_verified = 1, verify_token_hash = NULL, verify_token_expires = NULL WHERE id = ?", [row.id]);
  res.json({ message: "Email verified." });
});
