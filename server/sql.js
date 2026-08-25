// One async query interface over two databases.
//
// SQLite is still the default and still the right answer for a single host
// with a disk: it needs no service, no credentials, and no setup. But plenty
// of free hosting has an ephemeral filesystem, where a SQLite file quietly
// disappears on every redeploy — and the free tier of a hosted Postgres is
// exactly the thing that fixes that. So `DATABASE_URL` now decides:
//
//   (unset) / a path / :memory:   → SQLite (better-sqlite3)
//   postgres://… postgresql://…   → PostgreSQL (pg)
//   pglite / pglite:<dir>         → PGlite, real Postgres compiled to WASM,
//                                   used by the test suite so the Postgres
//                                   path is actually exercised rather than
//                                   written and hoped for.
//
// Everything below is async even on SQLite, where the driver is synchronous.
// A single interface that changes shape per backend is how you end up with a
// Postgres path nobody ever runs.

import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const RAW_URL = (process.env.DATABASE_URL || "").trim();

export const dialect = detectDialect(RAW_URL);

function detectDialect(url) {
  if (/^postgres(ql)?:\/\//i.test(url)) return "postgres";
  if (url === "pglite" || url.startsWith("pglite:")) return "postgres";
  return "sqlite";
}

// Queries are written once, with `?` placeholders, because that is what the
// overwhelming majority of them need. Postgres numbers its parameters instead,
// so they are renumbered on the way through. Anything inside a string literal
// is left alone — `LIKE '%?%'` would otherwise be mangled.
export function toPgPlaceholders(text) {
  let out = "";
  let quote = null;
  let n = 0;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quote) {
      out += c;
      if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"') {
      quote = c;
      out += c;
      continue;
    }
    if (c === "?") {
      n += 1;
      out += `$${n}`;
      continue;
    }
    out += c;
  }
  return out;
}

// pg 8 treats sslmode=require (and prefer, and verify-ca) as verify-full,
// which is stricter than libpq. pg 9 will switch them to libpq semantics —
// encrypt, but don't check who you're talking to. That is a security setting
// getting quietly weaker on a dependency bump, so it is worth one line at
// boot rather than a surprise later. verify-full and no-verify both mean the
// same thing before and after, which is why they are what the README
// recommends.
const AMBIGUOUS_SSL_MODES = /[?&]sslmode=(require|prefer|verify-ca)(&|$)/i;

function warnAboutSslMode(url) {
  const match = AMBIGUOUS_SSL_MODES.exec(url);
  if (!match) return;
  console.warn(
    `[db] sslmode=${match[1]} currently verifies the server certificate, but a future pg release ` +
      `will stop. Use sslmode=verify-full to keep verifying, or sslmode=no-verify to say you don't want to.`
  );
}

// ---------------------------------------------------------------- drivers --

async function sqliteDriver() {
  const { default: Database } = await import("better-sqlite3");
  const file = RAW_URL || path.join(__dirname, "data.sqlite");
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  // Without this, two writers hitting the file at once fail instantly with
  // SQLITE_BUSY instead of waiting their turn.
  db.pragma("busy_timeout = 5000");
  db.pragma("foreign_keys = ON");

  const statements = new Map();
  const prepare = (text) => {
    if (!statements.has(text)) statements.set(text, db.prepare(text));
    return statements.get(text);
  };

  return {
    // Split by what the caller wants back rather than by sniffing the SQL.
    // A regex over the statement text got PRAGMA wrong — it returns rows but
    // starts with neither SELECT nor WITH — and silently reported that every
    // column was missing.
    async select(text, params = []) {
      return prepare(text).all(params);
    },
    async modify(text, params = []) {
      const info = prepare(text).run(params);
      return { changes: info.changes, lastId: info.lastInsertRowid };
    },
    async exec(text) {
      db.exec(text);
    },
    async close() {
      db.close();
    },
    native: db,
  };
}

async function postgresDriver() {
  if (RAW_URL === "pglite" || RAW_URL.startsWith("pglite:")) {
    const { PGlite } = await import("@electric-sql/pglite");
    const dir = RAW_URL.startsWith("pglite:") ? RAW_URL.slice("pglite:".length) : undefined;
    const db = await PGlite.create(dir);
    const run = async (text, params) => db.query(toPgPlaceholders(text), params);
    return {
      async select(text, params = []) {
        return (await run(text, params)).rows || [];
      },
      async modify(text, params = []) {
        const res = await run(text, params);
        return { changes: res.affectedRows ?? 0, rows: res.rows || [] };
      },
      async exec(text) {
        await db.exec(text);
      },
      async close() {
        await db.close();
      },
      native: db,
    };
  }

  const { default: pg } = await import("pg");
  warnAboutSslMode(RAW_URL);
  // Free Postgres tiers cap concurrent connections far lower than a default
  // pool assumes, and one process quietly eating the whole allowance is a bad
  // way to find that out.
  const max = Number(process.env.DATABASE_POOL_MAX) || 10;
  const pool = new pg.Pool({ connectionString: RAW_URL, max });
  // A pooled connection dropped by the server (an idle timeout, a restart)
  // is emitted here, not at a query. Without a listener Node treats it as an
  // unhandled 'error' event and takes the process down.
  pool.on("error", (err) => console.error("[db] idle client error:", err.message));
  return {
    async select(text, params = []) {
      return (await pool.query(toPgPlaceholders(text), params)).rows || [];
    },
    async modify(text, params = []) {
      const res = await pool.query(toPgPlaceholders(text), params);
      return { changes: res.rowCount ?? 0, rows: res.rows || [] };
    },
    async exec(text) {
      await pool.query(text);
    },
    async close() {
      await pool.end();
    },
    native: pool,
  };
}

const driver = await (dialect === "postgres" ? postgresDriver() : sqliteDriver());

// ------------------------------------------------------------- public API --

// SQLite has one connection, so a transaction on it is only safe while nothing
// else interleaves. The callbacks below never await anything slow, but they do
// await, and an await is all it takes for another request's handler to run.
// Serialising them costs nothing at this scale and removes the whole class of
// problem.
let queue = Promise.resolve();

export const sql = {
  dialect,

  async get(text, params = []) {
    return (await driver.select(text, params))[0];
  },

  async all(text, params = []) {
    return driver.select(text, params);
  },

  async run(text, params = []) {
    const { changes } = await driver.modify(text, params);
    return { changes: changes ?? 0 };
  },

  // Postgres has no lastInsertRowid; it hands the id back from the statement
  // itself. Appending RETURNING here keeps that difference out of every
  // caller.
  async insert(text, params = []) {
    if (dialect === "postgres") {
      const { rows } = await driver.modify(`${text} RETURNING id`, params);
      return { id: rows[0]?.id };
    }
    const { lastId } = await driver.modify(text, params);
    return { id: Number(lastId) };
  },

  async tx(fn) {
    const run = queue.then(async () => {
      // exec, not a prepared statement: better-sqlite3 refuses to prepare
      // transaction-control statements.
      await driver.exec("BEGIN");
      try {
        const result = await fn();
        await driver.exec("COMMIT");
        return result;
      } catch (e) {
        await driver.exec("ROLLBACK").catch(() => {});
        throw e;
      }
    });
    // The queue must not stay rejected, or every later transaction fails too.
    queue = run.then(
      () => {},
      () => {}
    );
    return run;
  },

  async exec(text) {
    return driver.exec(text);
  },

  async close() {
    return driver.close();
  },

  // Only the backup script needs this, and only on SQLite.
  get native() {
    return driver.native;
  },
};

// ---------------------------------------------------------- dialect bricks --

// The handful of places where one dialect simply spells something else.
export const D = {
  // "INSERT ... ON CONFLICT DO NOTHING" is standard in both, but SQLite's
  // shorthand isn't.
  insertOrIgnore: (table, columns, placeholders) =>
    `INSERT INTO ${table} (${columns}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
  // MAX() is a scalar in SQLite and an aggregate in Postgres, where the scalar
  // is GREATEST. Using the wrong one is a runtime error, not a wrong answer.
  greatest: dialect === "postgres" ? "GREATEST" : "MAX",
};

// Timestamps are generated here rather than by the database. SQLite's
// datetime('now') and Postgres's now() differ in both spelling and return
// type, and a column that comes back as a string on one backend and a Date on
// the other is a bug waiting for whichever one you tested less.
export function nowIso() {
  return new Date().toISOString().replace("T", " ").replace(/\.\d+Z$/, "");
}
