import { describe, it, expect } from "vitest";
import { sanitizeCustomCss } from "./sanitizeCss.js";

describe("sanitizeCustomCss", () => {
  it("keeps ordinary styling untouched", () => {
    const css = ".hero h1 { letter-spacing: -0.02em; color: #ff0000; padding: 12px; }";
    expect(sanitizeCustomCss(css)).toBe(css);
  });

  it("strips url() so a published page can't beacon visitors to a third party", () => {
    expect(sanitizeCustomCss("body { background: url(https://evil.test/pixel.png); }")).not.toMatch(/url\s*\(/i);
  });

  it("strips @import", () => {
    expect(sanitizeCustomCss('@import "https://evil.test/x.css";')).not.toMatch(/@import/i);
  });

  it("strips expression() and javascript: URLs", () => {
    expect(sanitizeCustomCss("width: expression(alert(1));")).not.toMatch(/expression\s*\(/i);
    expect(sanitizeCustomCss("background: javascript:alert(1);")).not.toMatch(/javascript\s*:/i);
  });

  it("prevents breaking out of the <style> element", () => {
    const out = sanitizeCustomCss("</style><script>alert(1)</script>");
    expect(out).not.toMatch(/<\/?\s*style/i);
    expect(out).not.toMatch(/<\s*script/i);
  });

  it("downgrades fixed-position overlays used for clickjacking", () => {
    const out = sanitizeCustomCss(".x { position: fixed; inset: 0; z-index: 9999; }");
    expect(out).not.toMatch(/position\s*:\s*fixed/i);
    expect(out).toMatch(/position:static/);
  });

  it("handles empty/nullish input", () => {
    expect(sanitizeCustomCss("")).toBe("");
    expect(sanitizeCustomCss(undefined)).toBe("");
    expect(sanitizeCustomCss(null)).toBe("");
  });
});
