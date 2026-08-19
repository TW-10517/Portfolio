import rateLimit from "express-rate-limit";

const WINDOW_MS = 15 * 60 * 1000;

function limiter(limit) {
  return rateLimit({
    windowMs: WINDOW_MS,
    limit,
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
