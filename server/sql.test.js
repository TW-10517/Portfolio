import { describe, it, expect } from "vitest";
import { toPgPlaceholders } from "./sql.js";

// Queries are written once with `?` and renumbered for Postgres. Getting this
// wrong doesn't fail loudly — it shifts every parameter by one and quietly
// looks up the wrong row.
describe("toPgPlaceholders", () => {
  it("numbers placeholders in order", () => {
    expect(toPgPlaceholders("SELECT * FROM users WHERE email = ? AND id = ?")).toBe(
      "SELECT * FROM users WHERE email = $1 AND id = $2"
    );
  });

  it("leaves a query with no parameters alone", () => {
    expect(toPgPlaceholders("SELECT 1")).toBe("SELECT 1");
  });

  it("does not touch a question mark inside a string literal", () => {
    // Otherwise a LIKE pattern or a piece of prose in a default value gets
    // rewritten into a parameter reference that has no argument.
    expect(toPgPlaceholders("SELECT * FROM t WHERE a = ? AND b LIKE '%?%'")).toBe(
      "SELECT * FROM t WHERE a = $1 AND b LIKE '%?%'"
    );
    expect(toPgPlaceholders(`SELECT * FROM t WHERE a = "we?rd" AND b = ?`)).toBe(
      `SELECT * FROM t WHERE a = "we?rd" AND b = $1`
    );
  });

  it("keeps counting after a string literal", () => {
    expect(toPgPlaceholders("SELECT ? , '?' , ?")).toBe("SELECT $1 , '?' , $2");
  });

  it("handles a multi-line statement", () => {
    const out = toPgPlaceholders(`
      INSERT INTO image_blobs (hash, mime, bytes, size, created_at)
      VALUES (?, ?, ?, ?, ?)`);
    expect(out).toContain("VALUES ($1, $2, $3, $4, $5)");
  });
});
