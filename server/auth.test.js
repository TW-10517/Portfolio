import { describe, it, expect } from "vitest";
import {
  validateRegistration,
  validateLogin,
  validatePasswordReset,
  hashPassword,
  verifyPassword,
  generateRawToken,
  hashToken,
  isTokenExpired,
} from "./auth.js";

describe("validateRegistration", () => {
  it("passes for valid input", () => {
    expect(validateRegistration({ name: "Ada", email: "ada@example.com", password: "letmein1" })).toEqual({});
  });

  it("rejects a missing name", () => {
    expect(validateRegistration({ name: "  ", email: "ada@example.com", password: "letmein1" })).toHaveProperty("name");
  });

  it("rejects an invalid email", () => {
    expect(validateRegistration({ name: "Ada", email: "not-an-email", password: "letmein1" })).toHaveProperty("email");
  });

  it("rejects a short password", () => {
    expect(validateRegistration({ name: "Ada", email: "ada@example.com", password: "abc123" })).toHaveProperty("password");
  });

  it("rejects a password with no digit", () => {
    expect(validateRegistration({ name: "Ada", email: "ada@example.com", password: "letmeinnn" })).toHaveProperty("password");
  });
});

describe("validateLogin", () => {
  it("passes for valid input", () => {
    expect(validateLogin({ email: "ada@example.com", password: "anything" })).toEqual({});
  });

  it("rejects a missing password without enforcing complexity", () => {
    const errors = validateLogin({ email: "ada@example.com", password: "" });
    expect(errors).toHaveProperty("password");
  });
});

describe("validatePasswordReset", () => {
  it("enforces the same rules as registration", () => {
    expect(validatePasswordReset({ password: "short" })).toHaveProperty("password");
    expect(validatePasswordReset({ password: "longenough1" })).toEqual({});
  });
});

describe("password hashing", () => {
  it("round-trips correctly and rejects wrong passwords", async () => {
    const hash = await hashPassword("correct-horse-1");
    expect(hash).not.toBe("correct-horse-1");
    expect(await verifyPassword("correct-horse-1", hash)).toBe(true);
    expect(await verifyPassword("wrong-password-1", hash)).toBe(false);
  });
});

describe("reset/verify tokens", () => {
  it("generates high-entropy, distinct raw tokens", () => {
    const a = generateRawToken();
    const b = generateRawToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it("hashes deterministically so a stored hash can be matched later", () => {
    const raw = generateRawToken();
    expect(hashToken(raw)).toBe(hashToken(raw));
    expect(hashToken(raw)).not.toBe(raw);
  });

  it("treats missing/past expiry as expired", () => {
    expect(isTokenExpired(null)).toBe(true);
    expect(isTokenExpired(new Date(Date.now() - 1000).toISOString())).toBe(true);
    expect(isTokenExpired(new Date(Date.now() + 100000).toISOString())).toBe(false);
  });
});
