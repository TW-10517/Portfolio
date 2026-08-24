import { describe, it, expect, beforeEach } from "vitest";

process.env.DATABASE_URL = ":memory:";
process.env.JWT_SECRET = "test-secret";

const { SqliteRateLimitStore } = await import("./SqliteRateLimitStore.js");
const { db } = await import("./db.js");

function makeStore(windowMs = 1000, limit = 5) {
  const store = new SqliteRateLimitStore();
  store.init({ windowMs, limit });
  return store;
}

beforeEach(() => db.prepare("DELETE FROM rate_limits").run());

describe("SqliteRateLimitStore", () => {
  it("counts hits per key", async () => {
    const store = makeStore();
    expect((await store.increment("1.2.3.4")).totalHits).toBe(1);
    expect((await store.increment("1.2.3.4")).totalHits).toBe(2);
    expect((await store.increment("1.2.3.4")).totalHits).toBe(3);
  });

  it("keeps separate counts for separate keys", async () => {
    const store = makeStore();
    await store.increment("a");
    await store.increment("a");
    expect((await store.increment("b")).totalHits).toBe(1);
  });

  it("keeps separate counts for separate limiters on the same key", async () => {
    // Login and registration have their own allowances; a shared IP must not
    // burn one limiter's budget on the other's traffic.
    const login = makeStore(1000, 20);
    const register = makeStore(1000, 30);
    await login.increment("1.2.3.4");
    await login.increment("1.2.3.4");
    expect((await register.increment("1.2.3.4")).totalHits).toBe(1);
  });

  it("reports a reset time inside the window", async () => {
    const store = makeStore(60_000);
    const { resetTime } = await store.increment("k");
    const ms = resetTime.getTime() - Date.now();
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBeLessThanOrEqual(60_000);
  });

  it("starts a fresh window once the old one expires", async () => {
    const store = makeStore(40);
    await store.increment("k");
    await store.increment("k");
    await new Promise((r) => setTimeout(r, 60));
    expect((await store.increment("k")).totalHits).toBe(1);
  });

  it("survives a restart, unlike the in-memory default", async () => {
    // The whole point of the change: a new store object over the same
    // database must see the counts the previous process recorded.
    const before = makeStore(60_000, 5);
    await before.increment("1.2.3.4");
    await before.increment("1.2.3.4");

    const afterRestart = makeStore(60_000, 5);
    expect((await afterRestart.increment("1.2.3.4")).totalHits).toBe(3);
  });

  it("decrements without going negative", async () => {
    const store = makeStore();
    await store.increment("k");
    await store.decrement("k");
    await store.decrement("k");
    const row = db.prepare("SELECT hits FROM rate_limits WHERE key LIKE '%k'").get();
    expect(row.hits).toBe(0);
  });

  it("resets a single key", async () => {
    const store = makeStore();
    await store.increment("k");
    await store.resetKey("k");
    expect((await store.increment("k")).totalHits).toBe(1);
  });

  it("resetAll clears only its own limiter's keys", async () => {
    const login = makeStore(1000, 20);
    const register = makeStore(1000, 30);
    await login.increment("ip");
    await register.increment("ip");
    await login.resetAll();
    expect((await login.increment("ip")).totalHits).toBe(1);
    expect((await register.increment("ip")).totalHits).toBe(2);
  });
});
