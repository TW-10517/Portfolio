import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

// Must be set before app.js (and therefore db.js) is imported, so tests run
// against a throwaway in-memory database instead of the real dev DB file.
// ":memory:" is SQLite. `npm run test:pg` sets TEST_DATABASE_URL=pglite and
// runs this exact file against real PostgreSQL (compiled to WASM, no server),
// which is the only way the Postgres path stays honest.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || ":memory:";
process.env.JWT_SECRET = "test-secret";

const { app } = await import("../app.js");

function uniqueEmail() {
  return `user-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/auth/register", () => {
  it("creates an account and returns a token", async () => {
    const email = uniqueEmail();
    const res = await request(app).post("/api/auth/register").send({ name: "Ada Lovelace", email, password: "letmein1" });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user).toMatchObject({ email, name: "Ada Lovelace", emailVerified: false });
  });

  it("rejects a duplicate email", async () => {
    const email = uniqueEmail();
    await request(app).post("/api/auth/register").send({ name: "Ada", email, password: "letmein1" });
    const res = await request(app).post("/api/auth/register").send({ name: "Ada2", email, password: "letmein2" });
    expect(res.status).toBe(409);
    expect(res.body.errors.email).toMatch(/already exists/i);
  });

  it("rejects a weak password", async () => {
    const res = await request(app).post("/api/auth/register").send({ name: "Ada", email: uniqueEmail(), password: "abc" });
    expect(res.status).toBe(400);
    expect(res.body.errors).toHaveProperty("password");
  });
});

describe("POST /api/auth/login", () => {
  it("logs in with correct credentials", async () => {
    const email = uniqueEmail();
    await request(app).post("/api/auth/register").send({ name: "Ada", email, password: "letmein1" });
    const res = await request(app).post("/api/auth/login").send({ email, password: "letmein1" });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  it("rejects a wrong password with a generic error", async () => {
    const email = uniqueEmail();
    await request(app).post("/api/auth/register").send({ name: "Ada", email, password: "letmein1" });
    const res = await request(app).post("/api/auth/login").send({ email, password: "wrong-password" });
    expect(res.status).toBe(401);
    expect(res.body.errors.form).toMatch(/incorrect email or password/i);
  });

  it("rejects a login for an email that was never registered, with the same generic error", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: uniqueEmail(), password: "whatever1" });
    expect(res.status).toBe(401);
    expect(res.body.errors.form).toMatch(/incorrect email or password/i);
  });
});

describe("GET /api/auth/me", () => {
  it("requires a token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("rejects a garbage token", async () => {
    const res = await request(app).get("/api/auth/me").set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
  });

  it("returns the current user for a valid token", async () => {
    const email = uniqueEmail();
    const reg = await request(app).post("/api/auth/register").send({ name: "Ada", email, password: "letmein1" });
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${reg.body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(email);
  });
});

describe("POST /api/auth/logout", () => {
  it("invalidates the token it was called with", async () => {
    const email = uniqueEmail();
    const reg = await request(app).post("/api/auth/register").send({ name: "Ada", email, password: "letmein1" });
    const token = reg.body.token;

    const before = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(before.status).toBe(200);

    const logoutRes = await request(app).post("/api/auth/logout").set("Authorization", `Bearer ${token}`);
    expect(logoutRes.status).toBe(204);

    const after = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(after.status).toBe(401);
  });
});

describe("Password reset flow", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("issues a reset token, lets the user set a new password, and invalidates old sessions", async () => {
    const email = uniqueEmail();
    const reg = await request(app).post("/api/auth/register").send({ name: "Ada", email, password: "old-password-1" });
    const oldToken = reg.body.token;

    const forgotRes = await request(app).post("/api/auth/forgot-password").send({ email });
    expect(forgotRes.status).toBe(200);

    const logCall = console.log.mock.calls.find((args) => args.some((a) => String(a).includes("reset-password")));
    expect(logCall).toBeTruthy();
    const match = logCall.join(" ").match(/reset-password\/([a-f0-9]+)/);
    expect(match).toBeTruthy();
    const rawToken = match[1];

    const resetRes = await request(app).post("/api/auth/reset-password").send({ token: rawToken, password: "new-password-1" });
    expect(resetRes.status).toBe(200);

    // Old token should now be invalid (reset bumps token_version).
    const oldCheck = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${oldToken}`);
    expect(oldCheck.status).toBe(401);

    // Old password no longer works, new one does.
    const loginOld = await request(app).post("/api/auth/login").send({ email, password: "old-password-1" });
    expect(loginOld.status).toBe(401);
    const loginNew = await request(app).post("/api/auth/login").send({ email, password: "new-password-1" });
    expect(loginNew.status).toBe(200);
  });

  it("responds generically for an email that doesn't exist (no account enumeration)", async () => {
    const res = await request(app).post("/api/auth/forgot-password").send({ email: uniqueEmail() });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/if an account exists/i);
  });

  it("rejects an invalid/expired reset token", async () => {
    const res = await request(app).post("/api/auth/reset-password").send({ token: "not-a-real-token", password: "new-password-1" });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/change-password", () => {
  it("requires auth", async () => {
    const res = await request(app).post("/api/auth/change-password").send({ currentPassword: "a", newPassword: "letmein2" });
    expect(res.status).toBe(401);
  });

  it("rejects a wrong current password", async () => {
    const email = uniqueEmail();
    const reg = await request(app).post("/api/auth/register").send({ name: "Ada", email, password: "letmein1" });
    const res = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${reg.body.token}`)
      .send({ currentPassword: "not-it", newPassword: "letmein2" });
    expect(res.status).toBe(401);
  });

  it("rejects a weak new password", async () => {
    const email = uniqueEmail();
    const reg = await request(app).post("/api/auth/register").send({ name: "Ada", email, password: "letmein1" });
    const res = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${reg.body.token}`)
      .send({ currentPassword: "letmein1", newPassword: "abc" });
    expect(res.status).toBe(400);
  });

  it("changes the password and invalidates existing sessions", async () => {
    const email = uniqueEmail();
    const reg = await request(app).post("/api/auth/register").send({ name: "Ada", email, password: "letmein1" });
    const oldToken = reg.body.token;

    const res = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${oldToken}`)
      .send({ currentPassword: "letmein1", newPassword: "letmein2" });
    expect(res.status).toBe(200);

    expect((await request(app).get("/api/auth/me").set("Authorization", `Bearer ${oldToken}`)).status).toBe(401);
    expect((await request(app).post("/api/auth/login").send({ email, password: "letmein1" })).status).toBe(401);
    expect((await request(app).post("/api/auth/login").send({ email, password: "letmein2" })).status).toBe(200);
  });
});

describe("DELETE /api/auth/me", () => {
  it("requires auth", async () => {
    const res = await request(app).delete("/api/auth/me").send({ password: "letmein1" });
    expect(res.status).toBe(401);
  });

  it("rejects a wrong password", async () => {
    const email = uniqueEmail();
    const reg = await request(app).post("/api/auth/register").send({ name: "Ada", email, password: "letmein1" });
    const res = await request(app).delete("/api/auth/me").set("Authorization", `Bearer ${reg.body.token}`).send({ password: "wrong-one" });
    expect(res.status).toBe(401);
    // account must still exist
    expect((await request(app).post("/api/auth/login").send({ email, password: "letmein1" })).status).toBe(200);
  });

  it("deletes the account, its portfolio, and frees the slug", async () => {
    const email = uniqueEmail();
    const reg = await request(app).post("/api/auth/register").send({ name: "Ada", email, password: "letmein1" });
    const token = reg.body.token;

    await request(app)
      .put("/api/portfolios/mine")
      .set("Authorization", `Bearer ${token}`)
      .send({ data: { profile: { name: "Ada" } }, slug: "ada-to-delete", visibility: "public" });
    expect((await request(app).get("/api/portfolios/by-slug/ada-to-delete")).status).toBe(200);

    const del = await request(app).delete("/api/auth/me").set("Authorization", `Bearer ${token}`).send({ password: "letmein1" });
    expect(del.status).toBe(204);

    // login no longer works, token is dead, and the published link is gone
    expect((await request(app).post("/api/auth/login").send({ email, password: "letmein1" })).status).toBe(401);
    expect((await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`)).status).toBe(401);
    expect((await request(app).get("/api/portfolios/by-slug/ada-to-delete")).status).toBe(404);
  });

  it("frees the email so it can be registered again", async () => {
    const email = uniqueEmail();
    const reg = await request(app).post("/api/auth/register").send({ name: "Ada", email, password: "letmein1" });
    await request(app).delete("/api/auth/me").set("Authorization", `Bearer ${reg.body.token}`).send({ password: "letmein1" });
    const again = await request(app).post("/api/auth/register").send({ name: "Ada Again", email, password: "letmein2" });
    expect(again.status).toBe(201);
  });
});

describe("Email verification", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("verifies the account via the token logged at registration", async () => {
    const email = uniqueEmail();
    await request(app).post("/api/auth/register").send({ name: "Ada", email, password: "letmein1" });

    const logCall = console.log.mock.calls.find((args) => args.some((a) => String(a).includes("verify-email")));
    const rawToken = logCall.join(" ").match(/verify-email\/([a-f0-9]+)/)[1];

    const verifyRes = await request(app).post("/api/auth/verify-email").send({ token: rawToken });
    expect(verifyRes.status).toBe(200);

    const login = await request(app).post("/api/auth/login").send({ email, password: "letmein1" });
    expect(login.body.user.emailVerified).toBe(true);
  });

  it("rejects an invalid verification token", async () => {
    const res = await request(app).post("/api/auth/verify-email").send({ token: "garbage" });
    expect(res.status).toBe(400);
  });
});
