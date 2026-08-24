import { describe, it, expect } from "vitest";
import { validatePortfolioData, LIMITS } from "./validatePortfolio.js";

const ok = (data) => expect(validatePortfolioData(data)).toBeNull();
const rejects = (data, match) => {
  const err = validatePortfolioData(data);
  expect(err).toBeTruthy();
  if (match) expect(err).toMatch(match);
};

describe("validatePortfolioData", () => {
  it("accepts a normal portfolio", () => {
    ok({
      profile: { name: "Ada", email: "ada@example.com", social: { github: "https://github.com/ada" } },
      projects: { items: [{ id: "1", name: "Nimbus", demoUrl: "https://nimbus.dev" }] },
    });
  });

  it("accepts inline images and an inline resume PDF", () => {
    ok({ profile: { avatar: "data:image/png;base64,AAAA", resumeUrl: "data:application/pdf;base64,AAAA" } });
  });

  it("rejects a non-object document", () => {
    rejects("nope", /must be an object/);
    rejects([1, 2, 3], /must be an object/);
    rejects(null, /must be an object/);
  });

  it("rejects javascript: anywhere in the document", () => {
    rejects({ projects: { items: [{ demoUrl: "javascript:alert(1)" }] } }, /unsupported scheme/);
    rejects({ a: { b: { c: ["  JAVASCRIPT:alert(1)"] } } }, /unsupported scheme/);
  });

  it("rejects a scheme hidden behind control characters", () => {
    rejects({ url: "java\tscript:alert(1)" }, /unsupported scheme/);
    rejects({ url: "java\nscript:alert(1)" }, /unsupported scheme/);
  });

  it("rejects other executable schemes", () => {
    rejects({ url: "vbscript:msgbox(1)" }, /unsupported scheme/);
  });

  it("rejects data: URLs that are not images or PDFs", () => {
    rejects({ url: "data:text/html,<script>alert(1)</script>" }, /unsupported scheme/);
  });

  it("rejects prototype-poisoning keys", () => {
    // JSON.parse keeps "__proto__" as an own property, so it survives to
    // whatever merges this document later.
    const evil = JSON.parse('{"profile":{"__proto__":{"admin":true}}}');
    rejects(evil, /reserved field name/);
  });

  it("rejects data nested past the depth limit", () => {
    let deep = "leaf";
    for (let i = 0; i < LIMITS.MAX_DEPTH + 3; i++) deep = { nested: deep };
    rejects(deep, /nested too deeply/);
  });

  it("allows nesting up to the limit", () => {
    let shallow = "leaf";
    for (let i = 0; i < LIMITS.MAX_DEPTH - 2; i++) shallow = { nested: shallow };
    ok(shallow);
  });

  it("rejects a document with too many fields", () => {
    const wide = {};
    for (let i = 0; i < LIMITS.MAX_NODES + 10; i++) wide[`k${i}`] = 1;
    rejects(wide, /too many fields/);
  });

  it("rejects an oversized document", () => {
    // One field just over the byte budget, built without exceeding the
    // per-string cap so it's the size check that fires.
    const chunk = "x".repeat(1024 * 1024);
    const big = {};
    for (let i = 0; i < 13; i++) big[`img${i}`] = chunk;
    rejects(big, /too large/);
  });

  it("does not choke on nulls, numbers and booleans", () => {
    ok({ a: null, b: 42, c: true, d: [null, 0, false] });
  });
});
