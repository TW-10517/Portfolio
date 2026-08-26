import { describe, expect, it } from "vitest";
import request from "supertest";

// ":memory:" is SQLite. `npm run test:pg` sets TEST_DATABASE_URL=pglite and
// runs this exact file against real PostgreSQL (compiled to WASM, no server),
// which is the only way the Postgres path stays honest.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || ":memory:";
process.env.JWT_SECRET = "test-secret";

const { app } = await import("../app.js");

async function publish({ slug, visibility = "public", password, name = "Ada Lovelace" }) {
  const email = `user-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const { body } = await request(app)
    .post("/api/auth/register")
    .send({ name: "Ada", email, password: "letmein1" });
  await request(app)
    .put("/api/portfolios/mine")
    .set("Authorization", `Bearer ${body.token}`)
    .send({
      data: { profile: { name, roles: "Mathematician, Writer", tagline: "The first programmer" }, meta: {} },
      slug,
      visibility,
      password,
    });
  return body.token;
}

describe("GET /p/:slug", () => {
  it("serves a public portfolio's own preview tags", async () => {
    await publish({ slug: "ada" });
    const res = await request(app).get("/p/ada");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/html/);
    expect(res.text).toContain('<meta property="og:title" content="Ada Lovelace — Mathematician" />');
    expect(res.text).toContain("The first programmer");
  });

  it("redirects a human to the app", async () => {
    await publish({ slug: "ada-two" });
    const res = await request(app).get("/p/ada-two");
    expect(res.text).toContain("/#/p/ada-two");
  });

  it("reveals nothing about a private portfolio", async () => {
    await publish({ slug: "hidden", visibility: "private", name: "Grace Hopper" });
    const res = await request(app).get("/p/hidden");
    expect(res.status).toBe(200);
    expect(res.text).not.toContain("Grace Hopper");
    expect(res.text).toContain("This portfolio is private");
  });

  it("reveals nothing about a password-protected portfolio", async () => {
    await publish({ slug: "locked", visibility: "password", password: "hunter22", name: "Katherine Johnson" });
    const res = await request(app).get("/p/locked");
    expect(res.text).not.toContain("Katherine Johnson");
  });

  it("answers an unknown slug exactly like a private one", async () => {
    await publish({ slug: "hidden-two", visibility: "private", name: "Grace Hopper" });
    const missing = await request(app).get("/p/no-such-portfolio-anywhere");
    const priv = await request(app).get("/p/hidden-two");
    expect(missing.status).toBe(200);
    // Same status, same body apart from the slug in the redirect target —
    // otherwise this route becomes an oracle for which slugs exist.
    // Supertest binds an ephemeral port, which lands in og:url, and the CSP
    // nonce is fresh per response by design. Both are normalised along with
    // the slug: neither carries any information about the portfolio, so only
    // real differences show up.
    const normalise = (text, slug) =>
      text
        .replace(new RegExp(slug, "g"), "X")
        .replace(/127\.0\.0\.1:\d+/g, "HOST")
        .replace(/nonce="[^"]+"/g, 'nonce="N"');
    expect(normalise(missing.text, "no-such-portfolio-anywhere")).toBe(normalise(priv.text, "hidden-two"));
  });

  it("does not count a crawler's unfurl as a view", async () => {
    const token = await publish({ slug: "counted" });
    await request(app).get("/p/counted");
    await request(app).get("/p/counted");
    const mine = await request(app).get("/api/portfolios/mine").set("Authorization", `Bearer ${token}`);
    expect(mine.body.portfolio.views).toBe(0);
  });

  it("locks the page down with a nonce rather than allowing inline script", async () => {
    await publish({ slug: "csp-one" });
    const res = await request(app).get("/p/csp-one");
    const csp = res.headers["content-security-policy"];
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain("unsafe-inline");

    // The nonce in the header has to be the one on the script, or the redirect
    // silently stops running for anyone whose browser enforces the policy.
    const nonce = /'nonce-([^']+)'/.exec(csp)[1];
    expect(res.text).toContain(`<script nonce="${nonce}">`);
  });

  it("uses a fresh nonce for every response", async () => {
    // A reused nonce is the same as no nonce: anyone who has seen one page can
    // write a script tag that the policy accepts.
    await publish({ slug: "csp-two" });
    const a = await request(app).get("/p/csp-two");
    const b = await request(app).get("/p/csp-two");
    expect(a.headers["content-security-policy"]).not.toBe(b.headers["content-security-policy"]);
  });
});
