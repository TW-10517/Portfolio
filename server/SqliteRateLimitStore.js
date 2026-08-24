import { db } from "./db.js";

// A persistent store for express-rate-limit. The default MemoryStore lives in
// process memory, which means limits reset on every restart and aren't shared
// between processes — so "20 login attempts per 15 minutes" was really "20 per
// 15 minutes per process, until the next deploy". SQLite is already a
// dependency and already the source of truth, so it costs nothing extra.
export class SqliteRateLimitStore {
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

  #sweep(now) {
    if (now - this.lastCleanup < this.cleanupIntervalMs) return;
    this.lastCleanup = now;
    db.prepare("DELETE FROM rate_limits WHERE reset_at <= ?").run(now);
  }

  #key(key) {
    return `${this.prefix}${key}`;
  }

  async increment(key) {
    const now = Date.now();
    this.#sweep(now);
    const id = this.#key(key);

    // Read and write in one transaction: two requests arriving together must
    // not both read the same count and each write back count+1.
    const run = db.transaction(() => {
      const row = db.prepare("SELECT hits, reset_at FROM rate_limits WHERE key = ?").get(id);
      if (!row || row.reset_at <= now) {
        const resetAt = now + this.windowMs;
        db.prepare("INSERT INTO rate_limits (key, hits, reset_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET hits = 1, reset_at = excluded.reset_at").run(id, resetAt);
        return { totalHits: 1, resetTime: new Date(resetAt) };
      }
      const hits = row.hits + 1;
      db.prepare("UPDATE rate_limits SET hits = ? WHERE key = ?").run(hits, id);
      return { totalHits: hits, resetTime: new Date(row.reset_at) };
    });

    return run();
  }

  async decrement(key) {
    db.prepare("UPDATE rate_limits SET hits = MAX(hits - 1, 0) WHERE key = ?").run(this.#key(key));
  }

  async resetKey(key) {
    db.prepare("DELETE FROM rate_limits WHERE key = ?").run(this.#key(key));
  }

  async resetAll() {
    db.prepare("DELETE FROM rate_limits WHERE key LIKE ?").run(`${this.prefix}%`);
  }
}
