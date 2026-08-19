import { describe, expect, it } from "vitest";
import request from "supertest";

process.env.DATABASE_URL = ":memory:";
process.env.JWT_SECRET = "test-secret";

const { app } = await import("../app.js");

function uniqueEmail() {
  return `user-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

async function registerAndGetToken() {
  const email = uniqueEmail();
  const res = await request(app).post("/api/auth/register").send({ name: "Ada", email, password: "letmein1" });
  return res.body.token;
}

const sampleData = { profile: { name: "Ada Lovelace" }, meta: {} };

describe("PUT/GET /api/portfolios/mine", () => {
  it("requires auth", async () => {
    const res = await request(app).get("/api/portfolios/mine");
    expect(res.status).toBe(401);
  });

  it("returns null before anything is saved", async () => {
    const token = await registerAndGetToken();
    const res = await request(app).get("/api/portfolios/mine").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.portfolio).toBeNull();
  });

  it("saves and round-trips the portfolio data", async () => {
    const token = await registerAndGetToken();
    const put = await request(app)
      .put("/api/portfolios/mine")
      .set("Authorization", `Bearer ${token}`)
      .send({ data: sampleData, slug: "ada-lovelace", visibility: "public" });
    expect(put.status).toBe(200);
    expect(put.body.portfolio.data).toEqual(sampleData);
    expect(put.body.portfolio.slug).toBe("ada-lovelace");

    const get = await request(app).get("/api/portfolios/mine").set("Authorization", `Bearer ${token}`);
    expect(get.body.portfolio.data).toEqual(sampleData);
  });

  it("auto-suffixes the slug on collision with another user's portfolio", async () => {
    const tokenA = await registerAndGetToken();
    const tokenB = await registerAndGetToken();
    await request(app).put("/api/portfolios/mine").set("Authorization", `Bearer ${tokenA}`).send({ data: sampleData, slug: "shared-slug", visibility: "public" });
    const res = await request(app).put("/api/portfolios/mine").set("Authorization", `Bearer ${tokenB}`).send({ data: sampleData, slug: "shared-slug", visibility: "public" });
    expect(res.body.portfolio.slug).toBe("shared-slug-1");
  });
});

describe("GET /api/portfolios/by-slug/:slug", () => {
  it("returns data for a public portfolio and increments views", async () => {
    const token = await registerAndGetToken();
    const put = await request(app).put("/api/portfolios/mine").set("Authorization", `Bearer ${token}`).send({ data: sampleData, slug: "public-one", visibility: "public" });
    const slug = put.body.portfolio.slug;

    const res = await request(app).get(`/api/portfolios/by-slug/${slug}`);
    expect(res.status).toBe(200);
    expect(res.body.portfolio.data).toEqual(sampleData);
    expect(res.body.portfolio.views).toBe(1);
  });

  it("never exposes data for a private portfolio, and is indistinguishable from a missing one", async () => {
    const token = await registerAndGetToken();
    const put = await request(app).put("/api/portfolios/mine").set("Authorization", `Bearer ${token}`).send({ data: sampleData, slug: "private-one", visibility: "private" });
    const slug = put.body.portfolio.slug;

    const res = await request(app).get(`/api/portfolios/by-slug/${slug}`);
    const missing = await request(app).get("/api/portfolios/by-slug/definitely-not-a-real-slug");
    expect(res.status).toBe(404);
    expect(res.body).toEqual(missing.body); // no slug-existence leak
    expect(JSON.stringify(res.body)).not.toContain("Ada Lovelace");
  });

  it("withholds data for a password-protected portfolio until unlocked", async () => {
    const token = await registerAndGetToken();
    const put = await request(app)
      .put("/api/portfolios/mine")
      .set("Authorization", `Bearer ${token}`)
      .send({ data: sampleData, slug: "locked-one", visibility: "password", password: "secret123" });
    const slug = put.body.portfolio.slug;

    const peek = await request(app).get(`/api/portfolios/by-slug/${slug}`);
    expect(peek.body.portfolio.visibility).toBe("password");
    expect(peek.body.portfolio.data).toBeUndefined();

    const wrong = await request(app).post(`/api/portfolios/by-slug/${slug}/unlock`).send({ password: "nope" });
    expect(wrong.status).toBe(401);

    const right = await request(app).post(`/api/portfolios/by-slug/${slug}/unlock`).send({ password: "secret123" });
    expect(right.status).toBe(200);
    expect(right.body.data).toEqual(sampleData);
  });

  it("keeps the existing password when republishing without sending a new one", async () => {
    const token = await registerAndGetToken();
    const put1 = await request(app)
      .put("/api/portfolios/mine")
      .set("Authorization", `Bearer ${token}`)
      .send({ data: sampleData, slug: "keep-pw", visibility: "password", password: "first-pass" });
    const slug = put1.body.portfolio.slug;

    // republish without a password — should NOT clear/change it
    await request(app).put("/api/portfolios/mine").set("Authorization", `Bearer ${token}`).send({ data: sampleData, slug, visibility: "password", password: "" });

    const stillWorks = await request(app).post(`/api/portfolios/by-slug/${slug}/unlock`).send({ password: "first-pass" });
    expect(stillWorks.status).toBe(200);
  });

  it("returns 404 for an unknown slug", async () => {
    const res = await request(app).get("/api/portfolios/by-slug/does-not-exist");
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/portfolios/mine", () => {
  it("requires auth", async () => {
    const res = await request(app).delete("/api/portfolios/mine");
    expect(res.status).toBe(401);
  });

  it("removes the portfolio and kills the share link", async () => {
    const token = await registerAndGetToken();
    const put = await request(app).put("/api/portfolios/mine").set("Authorization", `Bearer ${token}`).send({ data: sampleData, slug: "to-delete", visibility: "public" });
    const slug = put.body.portfolio.slug;
    expect((await request(app).get(`/api/portfolios/by-slug/${slug}`)).status).toBe(200);

    const del = await request(app).delete("/api/portfolios/mine").set("Authorization", `Bearer ${token}`);
    expect(del.status).toBe(204);

    expect((await request(app).get(`/api/portfolios/by-slug/${slug}`)).status).toBe(404);
    expect((await request(app).get("/api/portfolios/mine").set("Authorization", `Bearer ${token}`)).body.portfolio).toBeNull();
  });
});
