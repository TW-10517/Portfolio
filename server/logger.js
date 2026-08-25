// Structured logs, so a failure is findable after it happens.
//
// Until now a 500 printed a stack trace to stdout and that was it: no request
// id to tie it to a user's report, no status, no timing, and on a managed host
// it scrolls away and is gone at the next redeploy. One line of JSON per event
// is enough to fix that, and every host's log viewer can already filter it.
//
// Nothing is sent anywhere by default. ERROR_WEBHOOK_URL exists for people who
// want errors pushed to Sentry, Slack or their own endpoint, and it stays off
// unless set — stack traces from this app can carry portfolio content and
// email addresses, and that is not a decision to make on someone's behalf.

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN_LEVEL = LEVELS[(process.env.LOG_LEVEL || "info").toLowerCase()] ?? LEVELS.info;

// Pretty output for a terminal, one JSON line for anything that will be
// parsed. A developer reading their own console does not want JSON; a log
// aggregator does not want ANSI colour.
const PRETTY = process.env.LOG_FORMAT
  ? process.env.LOG_FORMAT === "pretty"
  : process.env.NODE_ENV !== "production" && process.stdout.isTTY;

// Anything whose name suggests a secret never reaches the log, whatever it
// holds. Matching on the key rather than the value means a new field is
// redacted by default if it is named honestly.
const SECRET_KEY = /pass|secret|token|authorization|cookie|key$|apikey/i;

// Portfolio content is the user's writing, and their email is theirs. Neither
// belongs in an operational log, and a stack trace is not a good enough reason
// to copy them somewhere.
const PRIVATE_KEY = /^(data|portfolio|email|photo|bio|resumeUrl)$/i;

const MAX_STRING = 512;

export function redact(value, depth = 0) {
  if (value == null) return value;
  if (typeof value === "string") return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  if (typeof value !== "object") return value;
  if (depth > 4) return "[deep]";
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1));

  const out = {};
  for (const [key, v] of Object.entries(value)) {
    if (SECRET_KEY.test(key)) out[key] = "[redacted]";
    else if (PRIVATE_KEY.test(key)) out[key] = "[omitted]";
    else out[key] = redact(v, depth + 1);
  }
  return out;
}

function emit(level, message, fields = {}) {
  if (LEVELS[level] < MIN_LEVEL) return;
  const entry = { level, time: new Date().toISOString(), msg: message, ...redact(fields) };
  const line = PRETTY
    ? `${level.toUpperCase().padEnd(5)} ${message} ${Object.keys(fields).length ? JSON.stringify(redact(fields)) : ""}`.trim()
    : JSON.stringify(entry);
  // Warnings and errors go to stderr so a host that separates the streams can
  // alert on one of them.
  (level === "error" || level === "warn" ? console.error : console.log)(line);
  if (level === "error") ship(entry);
}

// Fire-and-forget, and deliberately silent about its own failures: a logger
// that throws while reporting an error turns one problem into two.
function ship(entry) {
  const url = process.env.ERROR_WEBHOOK_URL;
  if (!url) return;
  try {
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
      signal: AbortSignal.timeout(5000),
    }).catch(() => {});
  } catch {
    /* never let reporting break the request */
  }
}

export const log = {
  debug: (msg, fields) => emit("debug", msg, fields),
  info: (msg, fields) => emit("info", msg, fields),
  warn: (msg, fields) => emit("warn", msg, fields),
  error: (msg, fields) => emit("error", msg, fields),
};

// Errors are logged by shape rather than by stringifying them, so the stack
// stays a stack and the message stays searchable.
export function describeError(error) {
  if (!(error instanceof Error)) return { error: String(error) };
  return {
    error: error.message,
    type: error.name,
    code: error.code,
    stack: error.stack?.split("\n").slice(0, 12).join("\n"),
  };
}
