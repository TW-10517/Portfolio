import { describe, expect, it, afterAll } from "vitest";
import request from "supertest";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

// The rest of the Postgres testing runs PGlite in-process, which proves the
// SQL but never touches the `pg` driver — the one that actually runs in
// production. Different wire protocol handling, different type parsers,
// different pooling, different failure modes.
//
// This boots PGlite behind a TCP socket speaking the real PostgreSQL wire
// protocol and points `pg` at it, so the production driver path is exercised
// by something rather than by nobody. What it still doesn't cover is TLS and a
// remote host's timeouts.
const PORT = 55433;

const pglite = await PGlite.create();
const socketServer = new PGLiteSocketServer({ db: pglite, port: PORT, host: "127.0.0.1" });
await socketServer.start();

process.env.DATABASE_URL = `postgres://postgres:postgres@127.0.0.1:${PORT}/postgres`;
// pglite-socket serves one connection at a time.
process.env.DATABASE_POOL_MAX = "1";
process.env.JWT_SECRET = "test-secret";

const { app } = await import("./app.js");
const { sql, dialect } = await import("./db.js");

afterAll(async () => {
  await sql.close();
  await socketServer.stop();
  await pglite.close();
});

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64, 42),
]);

async function account() {
  const email = `tcp-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const { body } = await request(app)
    .post("/api/auth/register")
    .send({ name: "Ada", email, password: "letmein1" });
  return { token: body.token, email };
}

describe("the pg driver over a real TCP connection", () => {
  it("connected to Postgres, not to SQLite", async () => {
    expect(dialect).toBe("postgres");
    const row = await sql.get("SELECT version() AS v");
    expect(row.v).toMatch(/PostgreSQL/);
  });

  it("registers and logs in", async () => {
    const { email } = await account();
    const login = await request(app).post("/api/auth/login").send({ email, password: "letmein1" });
    expect(login.status).toBe(200);
    expect(login.body.token).toBeTruthy();
  });

  it("returns a generated id from an insert", async () => {
    // Postgres has no lastInsertRowid — sql.insert appends RETURNING id, and
    // the value has to survive the driver's type parsing as a number.
    const { token } = await account();
    const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(Number.isInteger(me.body.user.id)).toBe(true);
  });

  it("saves and reads back a portfolio", async () => {
    const { token } = await account();
    const slug = `tcp-${Date.now()}`;
    const save = await request(app)
      .put("/api/portfolios/mine")
      .set("Authorization", `Bearer ${token}`)
      .send({ data: { profile: { name: "Ada Lovelace" }, meta: {} }, slug, visibility: "public" });
    expect(save.status).toBe(200);

    const public_ = await request(app).get(`/api/portfolios/by-slug/${save.body.portfolio.slug}`);
    expect(public_.body.portfolio.data.profile.name).toBe("Ada Lovelace");
  });

  it("round-trips image bytes through BYTEA", async () => {
    // The driver decides how BYTEA arrives. pg gives a Buffer; a mismatch here
    // would serve corrupted images rather than failing loudly.
    const { token } = await account();
    const up = await request(app)
      .post("/api/images")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/octet-stream")
      .send(PNG);
    expect(up.status).toBe(201);

    const fetched = await request(app).get(up.body.url);
    expect(fetched.status).toBe(200);
    expect(Buffer.compare(fetched.body, PNG)).toBe(0);
  });

  it("counts a rate limit window that actually expires", async () => {
    // reset_at is BIGINT, which pg hands back as a string. Comparing that to a
    // number is false every time, which would make every window immortal.
    const { RateLimitStore } = await import("./RateLimitStore.js");
    const store = new RateLimitStore();
    store.init({ windowMs: 50, limit: 5 });
    expect((await store.increment("tcp")).totalHits).toBe(1);
    expect((await store.increment("tcp")).totalHits).toBe(2);
    await new Promise((r) => setTimeout(r, 80));
    expect((await store.increment("tcp")).totalHits).toBe(1);
  });

  it("sums image usage as a number", async () => {
    // SUM() is numeric, which also arrives as a string.
    const { token } = await account();
    await request(app)
      .post("/api/images")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/octet-stream")
      .send(PNG);
    const usage = await request(app).get("/api/images").set("Authorization", `Bearer ${token}`);
    expect(usage.body.used).toBe(PNG.length);
  });

  it("deletes an account, its portfolio and its images", async () => {
    const { token } = await account();
    const up = await request(app)
      .post("/api/images")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/octet-stream")
      .send(Buffer.concat([PNG, Buffer.from("unique")]));

    await request(app)
      .delete("/api/auth/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ password: "letmein1" });

    expect((await request(app).get(up.body.url)).status).toBe(404);
  });

  it("commits a transaction across the socket", async () => {
    // sql.tx issues BEGIN/COMMIT as separate statements; on a pool they must
    // land on the same connection to mean anything.
    await sql.tx(async () => {
      await sql.run("CREATE TABLE IF NOT EXISTS tx_probe (n INTEGER)");
      await sql.run("INSERT INTO tx_probe (n) VALUES (?)", [1]);
    });
    const row = await sql.get("SELECT COUNT(*) AS c FROM tx_probe");
    expect(Number(row.c)).toBe(1);
  });

  it("rolls back a failed transaction", async () => {
    await sql.run("CREATE TABLE IF NOT EXISTS rb_probe (n INTEGER)");
    await expect(
      sql.tx(async () => {
        await sql.run("INSERT INTO rb_probe (n) VALUES (?)", [1]);
        throw new Error("nope");
      })
    ).rejects.toThrow("nope");
    const row = await sql.get("SELECT COUNT(*) AS c FROM rb_probe");
    expect(Number(row.c)).toBe(0);
  });
});
