import { describe, expect, it, beforeEach, afterEach } from "vitest";
import request from "supertest";

// ":memory:" is SQLite. `npm run test:pg` sets TEST_DATABASE_URL=pglite and
// runs this exact file against real PostgreSQL (compiled to WASM, no server),
// which is the only way the Postgres path stays honest.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || ":memory:";
process.env.JWT_SECRET = "test-secret";

const { app } = await import("./app.js");
const { trustProxySetting } = await import("./trustProxy.js");
const { sql } = await import("./db.js");

// The limiters are keyed per IP and persisted, so each test starts clean or it
// inherits whatever the last one spent.
beforeEach(() => sql.run("DELETE FROM rate_limits"));

const badLogin = (ip) =>
  request(app)
    .post("/api/auth/login")
    .set("X-Forwarded-For", ip)
    .send({ email: `nobody-${ip}@example.com`, password: "wrongpass1" });

describe("trustProxySetting", () => {
  it("believes nobody unless told to", () => {
    // The safe default: an app exposed directly must not accept a header any
    // client can write.
    expect(trustProxySetting(undefined)).toBe(0);
    expect(trustProxySetting("")).toBe(0);
    expect(trustProxySetting("   ")).toBe(0);
  });

  it("takes a hop count", () => {
    expect(trustProxySetting("1")).toBe(1);
    expect(trustProxySetting("2")).toBe(2);
  });

  it("passes through Express's named forms", () => {
    expect(trustProxySetting("loopback")).toBe("loopback");
    expect(trustProxySetting("10.0.0.0/8")).toBe("10.0.0.0/8");
  });
});

describe("rate limits behind a proxy", () => {
  afterEach(() => app.set("trust proxy", 0));

  it("keeps one visitor's attempts away from another's", async () => {
    // This is the outage this exists to prevent. With the proxy untrusted,
    // req.ip is the proxy for everybody, so one person burning the login
    // limit locks out the entire site — for fifteen minutes, and across a
    // restart, because the counters are persisted.
    app.set("trust proxy", 1);

    for (let i = 0; i < 25; i += 1) await badLogin("203.0.113.7");
    expect((await badLogin("203.0.113.7")).status, "the noisy visitor should be limited").toBe(429);

    const bystander = await badLogin("198.51.100.99");
    expect(bystander.status, "a different visitor must not be locked out").not.toBe(429);
  });

  it("ignores a forged header when no proxy is trusted", async () => {
    // The opposite failure: if the header were believed unconditionally,
    // rotating it would walk straight past every limit.
    app.set("trust proxy", 0);

    for (let i = 0; i < 25; i += 1) await badLogin(`10.0.0.${i}`);
    const next = await badLogin("10.0.0.250");
    expect(next.status, "a new forged address must not buy a fresh allowance").toBe(429);
  });
});

describe("security headers", () => {
  it("sends them on API responses", async () => {
    const res = await request(app).get("/api/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("DENY");
    expect(res.headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(res.headers["permissions-policy"]).toContain("camera=()");
  });

  it("sends them on the share preview too", async () => {
    // The preview is HTML served to whoever a link was pasted in front of, so
    // it is the response that most needs them.
    const res = await request(app).get("/p/anything");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("DENY");
  });

  it("only claims HSTS when the visitor actually arrived over TLS", async () => {
    // Sent over plain HTTP it is ignored; sent from a dev server it would pin
    // localhost to HTTPS in the developer's browser, which is genuinely
    // annoying to undo.
    const plain = await request(app).get("/api/health");
    expect(plain.headers["strict-transport-security"]).toBeUndefined();

    const secure = await request(app).get("/api/health").set("X-Forwarded-Proto", "https");
    expect(secure.headers["strict-transport-security"]).toContain("max-age=31536000");
  });
});
