import { describe, expect, it, vi, afterEach } from "vitest";
import request from "supertest";

// ":memory:" is SQLite. `npm run test:pg` sets TEST_DATABASE_URL=pglite and
// runs this exact file against real PostgreSQL (compiled to WASM, no server),
// which is the only way the Postgres path stays honest.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || ":memory:";
process.env.JWT_SECRET = "test-secret";

const { app } = await import("./app.js");
const { sql } = await import("./db.js");
const { redact, describeError } = await import("./logger.js");

afterEach(() => vi.restoreAllMocks());

describe("redact", () => {
  it("never lets a secret through, whatever it holds", () => {
    const out = redact({
      password: "hunter2",
      password_hash: "$2b$10$abc",
      authorization: "Bearer xyz",
      apiKey: "sk-123",
      reset_token_hash: "deadbeef",
      cookie: "session=1",
    });
    for (const value of Object.values(out)) expect(value).toBe("[redacted]");
  });

  it("keeps the user's own writing out of an operational log", () => {
    // A stack trace is not a good enough reason to copy someone's portfolio
    // and email address into a log line.
    const out = redact({ email: "ada@example.com", data: { profile: { name: "Ada" } }, bio: "Long story" });
    expect(out.email).toBe("[omitted]");
    expect(out.data).toBe("[omitted]");
    expect(out.bio).toBe("[omitted]");
  });

  it("keeps the things worth logging", () => {
    const out = redact({ status: 500, method: "PUT", path: "/api/portfolios/mine", ms: 12 });
    expect(out).toEqual({ status: 500, method: "PUT", path: "/api/portfolios/mine", ms: 12 });
  });

  it("truncates instead of dumping something enormous", () => {
    const out = redact({ note: "x".repeat(5000) });
    expect(out.note.length).toBeLessThan(600);
    expect(out.note.endsWith("…")).toBe(true);
  });

  it("survives shapes that would otherwise blow the stack", () => {
    const deep = { a: { b: { c: { d: { e: { f: { g: "too far" } } } } } } };
    expect(() => redact(deep)).not.toThrow();
  });

  it("caps a long array instead of logging all of it", () => {
    const big = Array.from({ length: 200 }, (_, i) => i);
    const out = redact({ list: big });
    expect(out.list.length).toBe(20);
  });
});

describe("describeError", () => {
  it("keeps the stack a stack and the message searchable", () => {
    const described = describeError(new TypeError("nope"));
    expect(described.error).toBe("nope");
    expect(described.type).toBe("TypeError");
    expect(described.stack.split("\n").length).toBeLessThanOrEqual(12);
  });

  it("handles something thrown that isn't an Error", () => {
    expect(describeError("just a string")).toEqual({ error: "just a string" });
  });
});

describe("request ids", () => {
  it("returns one on every response", async () => {
    const res = await request(app).get("/api/health");
    expect(res.headers["x-request-id"]).toMatch(/^[\w-]{8,}$/);
  });

  it("keeps the id a proxy already assigned", async () => {
    // One request should be one id across every hop, not a new one per
    // service.
    const res = await request(app).get("/api/health").set("X-Request-Id", "abc-123");
    expect(res.headers["x-request-id"]).toBe("abc-123");
  });

  it("refuses a junk id rather than echoing it", async () => {
    const res = await request(app).get("/api/health").set("X-Request-Id", "not a valid id <script>");
    expect(res.headers["x-request-id"]).not.toContain("<script>");
  });
});

describe("GET /api/health", () => {
  it("reports the database it is actually using", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(["sqlite", "postgres"]).toContain(res.body.database);
    expect(typeof res.body.uptimeSeconds).toBe("number");
  });

  it("fails when the database is unreachable", async () => {
    // The whole point. A health check that answers ok:true from a process
    // whose database has gone is worse than none: the monitor stays green
    // through the one outage it exists to catch.
    vi.spyOn(sql, "get").mockRejectedValueOnce(new Error("connection lost"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(503);
    expect(res.body.ok).toBe(false);
    expect(res.body.database).toBe("unreachable");
  });
});
