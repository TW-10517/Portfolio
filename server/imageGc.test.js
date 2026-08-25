import { describe, expect, it } from "vitest";
import request from "supertest";

// ":memory:" is SQLite. `npm run test:pg` sets TEST_DATABASE_URL=pglite and
// runs this exact file against real PostgreSQL (compiled to WASM, no server),
// which is the only way the Postgres path stays honest.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || ":memory:";
process.env.JWT_SECRET = "test-secret";

const { app } = await import("./app.js");
const { sql } = await import("./db.js");
const { hashesIn, GRACE_MS } = await import("./imageGc.js");

const png = (fill) =>
  Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, fill)]);

async function account() {
  const email = `gc-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const { body } = await request(app)
    .post("/api/auth/register")
    .send({ name: "Ada", email, password: "letmein1" });
  return body.token;
}

const upload = (token, bytes) =>
  request(app)
    .post("/api/images")
    .set("Authorization", `Bearer ${token}`)
    .set("Content-Type", "application/octet-stream")
    .send(bytes);

const save = (token, data) =>
  request(app).put("/api/portfolios/mine").set("Authorization", `Bearer ${token}`).send({ data });

const blobCount = async (hash) =>
  Number((await sql.get("SELECT COUNT(*) AS c FROM image_blobs WHERE hash = ?", [hash])).c);

describe("hashesIn", () => {
  it("finds every stored image anywhere in a document", () => {
    const a = "a".repeat(64);
    const b = "b".repeat(64);
    const found = hashesIn({
      profile: { photo: `/api/images/${a}.webp` },
      projects: [{ images: [`/api/images/${b}.png`] }],
      about: { summary: "no image here" },
    });
    expect([...found].sort()).toEqual([a, b].sort());
  });

  it("ignores URLs that only look like one", () => {
    expect(hashesIn({ photo: "https://cdn.test/x.png" }).size).toBe(0);
    expect(hashesIn({ photo: "/api/images/short.png" }).size).toBe(0);
    expect(hashesIn(null).size).toBe(0);
  });
});

describe("deleting an account", () => {
  it("takes the account's uploaded images with it", async () => {
    // The regression this exists to stop: delete used to return 204, remove
    // the user and the portfolio, and leave their photographs on the server
    // still downloadable by anyone holding the URL.
    const token = await account();
    const { body } = await upload(token, png(11));
    expect((await request(app).get(body.url)).status).toBe(200);

    await request(app).delete("/api/auth/me").set("Authorization", `Bearer ${token}`).send({ password: "letmein1" });

    expect(await blobCount(body.hash)).toBe(0);
    expect((await request(app).get(body.url)).status).toBe(404);
  });

  it("keeps bytes another account is still using", async () => {
    // Storage is content-addressed, so two people with the same picture share
    // one row. One of them leaving must not delete the other's image.
    const shared = png(22);
    const leaving = await account();
    const staying = await account();
    const { body } = await upload(leaving, shared);
    await upload(staying, shared);

    await request(app).delete("/api/auth/me").set("Authorization", `Bearer ${leaving}`).send({ password: "letmein1" });

    expect(await blobCount(body.hash)).toBe(1);
    expect((await request(app).get(body.url)).status).toBe(200);
  });
});

describe("saving a portfolio", () => {
  it("keeps an image the portfolio still points at", async () => {
    const token = await account();
    const { body } = await upload(token, png(33));
    await save(token, { profile: { name: "Ada", photo: body.url }, meta: {} });
    expect(await blobCount(body.hash)).toBe(1);
  });

  it("does not reap an image uploaded moments ago", async () => {
    // A save from a second tab holds a copy of the portfolio from before the
    // upload. Without the grace period it would delete the picture the user
    // had just chosen.
    const token = await account();
    const { body } = await upload(token, png(44));
    await save(token, { profile: { name: "Ada" }, meta: {} });
    expect(await blobCount(body.hash)).toBe(1);
  });

  it("collects an image the portfolio stopped pointing at once it is old enough", async () => {
    const token = await account();
    const { body } = await upload(token, png(55));
    await save(token, { profile: { name: "Ada", photo: body.url }, meta: {} });

    // Age the claim past the grace period rather than waiting an hour.
    const old = new Date(Date.now() - GRACE_MS - 60_000).toISOString().replace("T", " ").replace(/\.\d+Z$/, "");
    await sql.run("UPDATE image_owners SET created_at = ? WHERE hash = ?", [old, body.hash]);

    await save(token, { profile: { name: "Ada", photo: "https://cdn.test/other.png" }, meta: {} });

    expect(await blobCount(body.hash)).toBe(0);
    expect((await request(app).get(body.url)).status).toBe(404);
  });
});
