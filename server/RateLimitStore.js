import { sql, D } from "./db.js";

// A persistent store for express-rate-limit. The default MemoryStore lives in
// process memory, which means limits reset on every restart and aren't shared
// between processes — so "20 login attempts per 15 minutes" was really "20 per
// 15 minutes per process, until the next deploy". The database is already a
// dependency and already the source of truth, so it costs nothing extra.
//
// Backend-agnostic: it runs on whichever database server/sql.js selected.
export class RateLimitStore {
  constructor({ cleanupIntervalMs = 5 * 60 * 1000 } = {}) {
    this.cleanupIntervalMs = cleanupIntervalMs;
    this.lastCleanup = 0;
  }

  // express-rate-limit hands the store its window on registration. Each
  // limiter gets its own prefix so separate counters don't collide on a
  // shared IP key.
  init(options) {
    this.windowMs = options.windowMs;
    this.prefix = `${options.windowMs}:${options.limit ?? options.max ?? "n"}:`;
  }

  async #sweep(now) {
    if (now - this.lastCleanup < this.cleanupIntervalMs) return;
    this.lastCleanup = now;
    await sql.run("DELETE FROM rate_limits WHERE reset_at <= ?", [now]);
  }

  #key(key) {
    return `${this.prefix}${key}`;
  }

  async increment(key) {
    const now = Date.now();
    await this.#sweep(now);
    const id = this.#key(key);

    // Read and write in one transaction: two requests arriving together must
    // not both read the same count and each write back count+1.
    return sql.tx(async () => {
      const row = await sql.get("SELECT hits, reset_at FROM rate_limits WHERE key = ?", [id]);
      // Postgres hands BIGINT back as a string, and "1756…" <= 1756… compares
      // as false every time — which would make every window immortal.
      const resetAt = row ? Number(row.reset_at) : 0;
      if (!row || resetAt <= now) {
        const next = now + this.windowMs;
        await sql.run(
          "INSERT INTO rate_limits (key, hits, reset_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET hits = 1, reset_at = excluded.reset_at",
          [id, next]
        );
        return { totalHits: 1, resetTime: new Date(next) };
      }
      const hits = Number(row.hits) + 1;
      await sql.run("UPDATE rate_limits SET hits = ? WHERE key = ?", [hits, id]);
      return { totalHits: hits, resetTime: new Date(resetAt) };
    });
  }

  async decrement(key) {
    // MAX() is a scalar in SQLite and an aggregate in Postgres, where the
    // scalar spelling is GREATEST.
    await sql.run(`UPDATE rate_limits SET hits = ${D.greatest}(hits - 1, 0) WHERE key = ?`, [this.#key(key)]);
  }

  async resetKey(key) {
    await sql.run("DELETE FROM rate_limits WHERE key = ?", [this.#key(key)]);
  }

  async resetAll() {
    await sql.run("DELETE FROM rate_limits WHERE key LIKE ?", [`${this.prefix}%`]);
  }
}
