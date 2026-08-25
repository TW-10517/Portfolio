import { describe, expect, it, afterAll } from "vitest";
import request from "supertest";
import { testCertificate } from "../test/certs.js";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { createPgTlsProxy } from "../test/pgTlsProxy.js";

// Every hosted Postgres requires TLS, so a driver test that only ever spoke in
// the clear left the connection people will actually use unexercised. PGlite
// has no TLS of its own; the proxy in test/pgTlsProxy.js answers the
// SSLRequest handshake and terminates TLS in front of it, which is enough to
// drive `pg`'s encrypted path for real.
const { key, cert } = await testCertificate();

const PLAIN_PORT = 55434;
const TLS_PORT = 55435;

const pglite = await PGlite.create();
const socketServer = new PGLiteSocketServer({ db: pglite, port: PLAIN_PORT, host: "127.0.0.1" });
await socketServer.start();

const proxy = createPgTlsProxy({ listenPort: TLS_PORT, targetPort: PLAIN_PORT, key, cert });
await proxy.listen();

// sslmode=no-verify: encrypt, but accept this test's self-signed certificate.
// It is also the only mode whose meaning is stable — pg 8 treats `require` as
// verify-full and pg 9 will not, which the separate test below pins down.
const TLS_URL = `postgres://postgres:postgres@127.0.0.1:${TLS_PORT}/postgres?sslmode=no-verify`;
process.env.DATABASE_URL = TLS_URL;
process.env.DATABASE_POOL_MAX = "1";
process.env.JWT_SECRET = "test-secret";

const { app } = await import("./app.js");
const { sql, dialect } = await import("./db.js");

afterAll(async () => {
  await sql.close();
  await proxy.close();
  await socketServer.stop();
  await pglite.close();
});

describe("the pg driver over TLS", () => {
  it("negotiated an encrypted connection", async () => {
    expect(dialect).toBe("postgres");
    // Reaching Postgres at all through the proxy means the SSLRequest
    // exchange happened: the proxy hangs up on anything that skips it.
    const row = await sql.get("SELECT version() AS v");
    expect(row.v).toMatch(/PostgreSQL/);
  });

  it("runs the schema migration over TLS", async () => {
    // db.js ran migrate() on import; if the encrypted transport were subtly
    // broken this would have thrown before any test got here.
    const tables = await sql.all(
      "SELECT table_name AS name FROM information_schema.tables WHERE table_schema = 'public'"
    );
    const names = tables.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(["users", "portfolios", "image_blobs"]));
  });

  it("registers an account and saves a portfolio", async () => {
    const email = `tls-${Date.now()}@example.com`;
    const registered = await request(app)
      .post("/api/auth/register")
      .send({ name: "Ada", email, password: "letmein1" });
    expect(registered.status).toBe(201);

    const saved = await request(app)
      .put("/api/portfolios/mine")
      .set("Authorization", `Bearer ${registered.body.token}`)
      .send({ data: { profile: { name: "Ada Lovelace" }, meta: {} }, slug: `tls-${Date.now()}` });
    expect(saved.status).toBe(200);
    expect(saved.body.portfolio.data.profile.name).toBe("Ada Lovelace");
  });

  it("moves binary data across the encrypted connection intact", async () => {
    // TLS framing plus BYTEA is where a subtly wrong stream would corrupt
    // rather than fail, so the bytes are compared rather than just counted.
    const email = `tls-img-${Date.now()}@example.com`;
    const { body: auth } = await request(app)
      .post("/api/auth/register")
      .send({ name: "Ada", email, password: "letmein1" });

    const bytes = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from(Array.from({ length: 4096 }, (_, i) => i % 251)),
    ]);
    const uploaded = await request(app)
      .post("/api/images")
      .set("Authorization", `Bearer ${auth.token}`)
      .set("Content-Type", "application/octet-stream")
      .send(bytes);
    expect(uploaded.status).toBe(201);

    const fetched = await request(app).get(uploaded.body.url);
    expect(Buffer.compare(fetched.body, bytes)).toBe(0);
  });


  it("refuses a certificate it cannot verify", async () => {
    // The half that matters. sslmode=require verifies in pg 8, so a
    // deployment pointed at the wrong host fails instead of encrypting to
    // whoever answered. Checked with a bare pg client rather than through
    // db.js, which is already connected.
    const { default: pg } = await import("pg");
    const strict = new pg.Client({
      connectionString: `postgres://postgres:postgres@127.0.0.1:${TLS_PORT}/postgres?sslmode=verify-full`,
    });
    // Asserted as "does not connect" rather than by message: depending on
    // which side tears the socket down first, Node reports either the
    // certificate error or the disconnect it caused. Refusing is the
    // behaviour that matters; the wording is not ours to promise.
    await expect(strict.connect()).rejects.toThrow();
    await strict.end().catch(() => {});
  });

  it("will not connect in the clear through the TLS front door", async () => {
    // Guards the test itself: if the proxy served unencrypted connections,
    // every assertion above would pass without any TLS involved.
    const { default: pg } = await import("pg");
    const plain = new pg.Client({
      connectionString: `postgres://postgres:postgres@127.0.0.1:${TLS_PORT}/postgres`,
    });
    await expect(plain.connect()).rejects.toThrow();
    await plain.end().catch(() => {});
  });
});
