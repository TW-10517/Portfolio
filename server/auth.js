import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { db } from "./db.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-only-insecure-secret-change-in-production";
const TOKEN_EXPIRY = "30d";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRegistration({ name, email, password }) {
  const errors = {};
  if (!name || !name.trim()) errors.name = "Name is required.";
  if (!email || !EMAIL_RE.test(email)) errors.email = "Enter a valid email address.";
  if (!password || password.length < 8) errors.password = "Password must be at least 8 characters.";
  else if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    errors.password = "Password must contain at least one letter and one number.";
  }
  return errors;
}

export function validateLogin({ email, password }) {
  const errors = {};
  if (!email || !EMAIL_RE.test(email)) errors.email = "Enter a valid email address.";
  if (!password) errors.password = "Password is required.";
  return errors;
}

export function validatePasswordReset({ password }) {
  const errors = {};
  if (!password || password.length < 8) errors.password = "Password must be at least 8 characters.";
  else if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    errors.password = "Password must contain at least one letter and one number.";
  }
  return errors;
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// user must include token_version (defaults to 0 for freshly-inserted rows).
export function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email, tokenVersion: user.token_version ?? 0 }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

// Rejects tokens whose embedded tokenVersion no longer matches the user's
// current token_version in the DB — this is what makes logout (and password
// reset) actually invalidate previously-issued tokens instead of just
// clearing client-side storage. Costs one indexed lookup per request.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing or invalid authorization header." });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const row = db.prepare("SELECT token_version FROM users WHERE id = ?").get(payload.sub);
    if (!row || row.token_version !== payload.tokenVersion) {
      return res.status(401).json({ error: "Invalid or expired session. Please log in again." });
    }
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session. Please log in again." });
  }
}

// --- Reset / verification tokens ---
// These are single-use, high-entropy random tokens (not passwords), so a
// fast SHA-256 hash — rather than bcrypt — is the right tool: we only ever
// need to store something that isn't the raw token in the DB, not to defend
// against offline brute-forcing of a short human-chosen secret.
export function generateRawToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function hashToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export function isTokenExpired(expiresAtIso) {
  if (!expiresAtIso) return true;
  return new Date(expiresAtIso).getTime() < Date.now();
}
