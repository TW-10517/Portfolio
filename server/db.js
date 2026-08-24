import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DATABASE_URL || path.join(__dirname, "data.sqlite");

export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS portfolios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    slug TEXT NOT NULL UNIQUE,
    data TEXT NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'public',
    password TEXT DEFAULT '',
    views INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_portfolios_user_id ON portfolios(user_id);

  -- Rate-limit counters. express-rate-limit's default store keeps these in
  -- process memory, so every restart handed attackers a fresh allowance and
  -- nothing was shared between workers. Persisting them here costs one small
  -- table and makes the limits mean what they say.
  CREATE TABLE IF NOT EXISTS rate_limits (
    key TEXT PRIMARY KEY,
    hits INTEGER NOT NULL,
    reset_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_at ON rate_limits(reset_at);
`);

// Idempotent column migrations — SQLite has no "ADD COLUMN IF NOT EXISTS",
// so we check PRAGMA table_info() and only add columns that are missing.
// Keeps existing dev databases (and this file's own history) working
// without a separate migration runner.
function addColumnIfMissing(table, column, definition) {
  const existing = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!existing.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

addColumnIfMissing("users", "token_version", "INTEGER NOT NULL DEFAULT 0");
addColumnIfMissing("users", "email_verified", "INTEGER NOT NULL DEFAULT 0");
addColumnIfMissing("users", "verify_token_hash", "TEXT");
addColumnIfMissing("users", "verify_token_expires", "TEXT");
addColumnIfMissing("users", "reset_token_hash", "TEXT");
addColumnIfMissing("users", "reset_token_expires", "TEXT");
