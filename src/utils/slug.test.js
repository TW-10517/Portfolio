import { describe, it, expect } from "vitest";
import { slugify } from "./slug.js";

describe("slugify", () => {
  it("lowercases and hyphenates spaces", () => {
    expect(slugify("Alex Rivera")).toBe("alex-rivera");
  });

  it("strips punctuation", () => {
    expect(slugify("Alex's Portfolio!!")).toBe("alexs-portfolio");
  });

  it("collapses repeated whitespace/hyphens", () => {
    expect(slugify("Alex   --  Rivera")).toBe("alex-rivera");
  });

  it("trims leading/trailing hyphens", () => {
    expect(slugify("  -Alex Rivera-  ")).toBe("alex-rivera");
  });

  it("handles empty/nullish input without throwing", () => {
    expect(slugify("")).toBe("");
    expect(slugify(undefined)).toBe("");
    expect(slugify(null)).toBe("");
  });
});
