import { describe, expect, it } from "vitest";
import request from "supertest";
import crypto from "crypto";

process.env.DATABASE_URL = ":memory:";
process.env.JWT_SECRET = "test-secret";

const { app } = await import("../app.js");

// Minimal but genuinely valid headers — the route sniffs the bytes rather
// than trusting Content-Type, so these have to be real.
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64, 7),
]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 3)]);
const WEBP = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.alloc(4),
  Buffer.from("WEBP"),
  Buffer.alloc(64, 5),
]);
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

async function token() {
  const email = `user-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const { body } = await request(app)
    .post("/api/auth/register")
    .send({ name: "Ada", email, password: "letmein1" });
  return body.token;
}

const upload = (t, bytes, type = "application/octet-stream") =>
  request(app).post("/api/images").set("Authorization", `Bearer ${t}`).set("Content-Type", type).send(bytes);

describe("POST /api/images", () => {
  it("requires auth", async () => {
    const res = await request(app).post("/api/images").set("Content-Type", "image/png").send(PNG);
    expect(res.status).toBe(401);
  });

  it("stores an image and returns a relative content-addressed URL", async () => {
    const res = await upload(await token(), PNG);
    expect(res.status).toBe(201);
    expect(res.body.hash).toBe(crypto.createHash("sha256").update(PNG).digest("hex"));
    // Relative on purpose: an absolute URL would bake the dev host into a
    // portfolio that later gets opened in production.
    expect(res.body.url).toBe(`/api/images/${res.body.hash}.png`);
  });

  it("gives the same bytes the same URL instead of storing them twice", async () => {
    const a = await upload(await token(), JPEG);
    const b = await upload(await token(), JPEG);
    expect(a.body.url).toBe(b.body.url);
  });

  it("rejects an SVG however it is labelled", async () => {
    // An SVG is a document that can carry script; served from our own origin
    // it would turn every upload into stored XSS.
    const res = await upload(await token(), SVG, "image/png");
    expect(res.status).toBe(400);
  });

  it("rejects a disguised file rather than trusting Content-Type", async () => {
    const res = await upload(await token(), Buffer.from("MZ  not an image at all"), "image/webp");
    expect(res.status).toBe(400);
  });

  it("rejects an empty body", async () => {
    const res = await upload(await token(), Buffer.alloc(0));
    expect(res.status).toBe(400);
  });

  it("accepts every format it claims to", async () => {
    const t = await token();
    for (const [bytes, ext] of [
      [PNG, "png"],
      [JPEG, "jpg"],
      [WEBP, "webp"],
    ]) {
      const res = await upload(t, bytes);
      expect(res.status, ext).toBe(201);
      expect(res.body.url.endsWith(`.${ext}`), res.body.url).toBe(true);
    }
  });
});

describe("GET /api/images/:file", () => {
  it("serves the bytes back to anyone, immutably", async () => {
    const { body } = await upload(await token(), WEBP);
    const res = await request(app).get(body.url);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("image/webp");
    expect(res.headers["cache-control"]).toContain("immutable");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(Buffer.compare(res.body, WEBP)).toBe(0);
  });

  it("404s an unknown or malformed hash without touching the database", async () => {
    expect((await request(app).get("/api/images/not-a-hash.png")).status).toBe(404);
    expect((await request(app).get(`/api/images/${"a".repeat(64)}.png`)).status).toBe(404);
  });

  it("reports what an account has used", async () => {
    const t = await token();
    await upload(t, PNG);
    const res = await request(app).get("/api/images").set("Authorization", `Bearer ${t}`);
    expect(res.body.used).toBe(PNG.length);
    expect(res.body.limit).toBeGreaterThan(0);
  });
});
