import { describe, it, expect } from "vitest";
import { sanitizeUrl, sanitizeDownloadUrl } from "./sanitizeUrl.js";

describe("sanitizeUrl", () => {
  it("keeps ordinary http and https links", () => {
    expect(sanitizeUrl("https://example.com/me")).toBe("https://example.com/me");
    expect(sanitizeUrl("http://example.com")).toBe("http://example.com/");
  });

  it("keeps mailto and tel links", () => {
    expect(sanitizeUrl("mailto:a@b.com")).toBe("mailto:a@b.com");
    expect(sanitizeUrl("tel:+81312345678")).toBe("tel:+81312345678");
  });

  it("upgrades a scheme-less address to https", () => {
    expect(sanitizeUrl("example.com/me")).toBe("https://example.com/me");
    expect(sanitizeUrl("www.example.com")).toBe("https://www.example.com/");
  });

  it("rejects javascript: URLs", () => {
    expect(sanitizeUrl("javascript:alert(1)")).toBeUndefined();
    expect(sanitizeUrl("JavaScript:alert(1)")).toBeUndefined();
    expect(sanitizeUrl("  javascript:alert(1)  ")).toBeUndefined();
  });

  it("rejects a scheme hidden behind control characters", () => {
    // Browsers strip these before resolving, so "java\tscript:" navigates
    // exactly like "javascript:".
    expect(sanitizeUrl("java\tscript:alert(1)")).toBeUndefined();
    expect(sanitizeUrl("java\nscript:alert(1)")).toBeUndefined();
    expect(sanitizeUrl("\u0000javascript:alert(1)")).toBeUndefined();
  });

  it("rejects other executable or opaque schemes", () => {
    expect(sanitizeUrl("vbscript:msgbox(1)")).toBeUndefined();
    expect(sanitizeUrl("file:///etc/passwd")).toBeUndefined();
    expect(sanitizeUrl("blob:https://example.com/abc")).toBeUndefined();
  });

  it("rejects data: URLs by default, including HTML ones", () => {
    expect(sanitizeUrl("data:text/html,<script>alert(1)</script>")).toBeUndefined();
    expect(sanitizeUrl("data:application/pdf;base64,AAAA")).toBeUndefined();
  });

  it("allows an inline PDF only when the caller opts in", () => {
    expect(sanitizeDownloadUrl("data:application/pdf;base64,AAAA")).toBe("data:application/pdf;base64,AAAA");
    // Opting in must not widen the allowlist to other data types.
    expect(sanitizeDownloadUrl("data:text/html,<script>alert(1)</script>")).toBeUndefined();
  });

  it("keeps in-page anchors and site-relative paths", () => {
    expect(sanitizeUrl("#projects")).toBe("#projects");
    expect(sanitizeUrl("/about")).toBe("/about");
  });

  it("treats a protocol-relative URL as off-site and checks it", () => {
    expect(sanitizeUrl("//example.com/x")).toBe("https://example.com/x");
  });

  it("returns undefined for empty input so no href is rendered", () => {
    expect(sanitizeUrl("")).toBeUndefined();
    expect(sanitizeUrl("   ")).toBeUndefined();
    expect(sanitizeUrl(null)).toBeUndefined();
    expect(sanitizeUrl(undefined)).toBeUndefined();
  });
});
