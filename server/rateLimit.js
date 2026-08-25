import rateLimit from "express-rate-limit";
import { RateLimitStore } from "./RateLimitStore.js";

const WINDOW_MS = 15 * 60 * 1000;

// The browser suite registers roughly as many accounts in one run as a real
// user would in a lifetime, which legitimately exhausted the 30/15min budget
// and made the tail of the suite fail on a 429. Tests raise the ceiling with
// RATE_LIMIT_SCALE; production ignores it, so a stray environment variable
// can't quietly switch off a brute-force control on a live server.
function scale() {
  if (process.env.NODE_ENV === "production") return 1;
  const n = Number(process.env.RATE_LIMIT_SCALE);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

function limiter(limit) {
  return rateLimit({
    windowMs: WINDOW_MS,
    limit: limit * scale(),
    // Persisted rather than in-memory, so a restart doesn't hand out a fresh
    // allowance and separate processes share one counter.
    store: new RateLimitStore(),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many attempts. Please wait a while before trying again." },
  });
}

// Separate counters per purpose (not one shared limiter across every auth
// route) — otherwise a burst of password-reset requests could lock a user
// out of logging in, and vice versa. Login gets the tightest limit since
// it's the classic credential-stuffing target; the token-based flows are
// lower-risk (the tokens themselves are high-entropy) so their limit is
// mainly about abuse/spam, not brute force.
export const loginLimiter = limiter(20);
export const registerLimiter = limiter(30);
export const tokenLimiter = limiter(30);
// Uploads are per-account rather than per-attack: a portfolio with a photo on
// every project is a few dozen files, and this leaves room for redoing them.
export const uploadLimiter = limiter(200);
