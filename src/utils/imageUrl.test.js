import { describe, it, expect } from "vitest";
import { resolveImageUrl, isStoredImage } from "./imageUrl.js";

const API = "http://localhost:4000/api";

describe("resolveImageUrl", () => {
  it("puts the API's origin back on a stored image", () => {
    expect(resolveImageUrl("/api/images/abc.webp", API)).toBe("http://localhost:4000/api/images/abc.webp");
  });

  it("works when the API is served from the app's own origin", () => {
    expect(resolveImageUrl("/api/images/abc.webp", "/api")).toBe("/api/images/abc.webp");
  });

  it("leaves everything else exactly as it is", () => {
    // These are, in order: a URL the author typed, the default portfolio's
    // placeholder, and an upload that never reached the server.
    for (const src of [
      "https://cdn.example.com/photo.png",
      "https://placehold.co/500x500",
      "data:image/webp;base64,AAAA",
      "",
    ]) {
      expect(resolveImageUrl(src, API)).toBe(src);
    }
  });

  it("passes through anything that isn't a string", () => {
    expect(resolveImageUrl(undefined, API)).toBe(undefined);
    expect(resolveImageUrl(null, API)).toBe(null);
  });

  it("does not rewrite some other path on the API", () => {
    expect(resolveImageUrl("/api/portfolios/mine", API)).toBe("/api/portfolios/mine");
  });
});

describe("isStoredImage", () => {
  it("recognises only the stored form", () => {
    expect(isStoredImage("/api/images/abc.webp")).toBe(true);
    expect(isStoredImage("data:image/png;base64,AA")).toBe(false);
    expect(isStoredImage(null)).toBe(false);
  });
});
