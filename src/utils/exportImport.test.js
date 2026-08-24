import { describe, it, expect } from "vitest";
import { fitWithin, MAX_IMAGE_DIMENSION } from "./exportImport.js";

describe("fitWithin", () => {
  it("leaves an image that already fits untouched", () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600, scaled: false });
  });

  it("treats an image exactly on the limit as fitting", () => {
    expect(fitWithin(1600, 1600, 1600)).toEqual({ width: 1600, height: 1600, scaled: false });
  });

  it("scales the longest edge down to the limit", () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200, scaled: true });
  });

  it("scales by height when the image is portrait", () => {
    expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600, scaled: true });
  });

  it("preserves aspect ratio for extreme panoramas", () => {
    const { width, height } = fitWithin(10000, 500, 1600);
    expect(width).toBe(1600);
    // 500/10000 * 1600 = 80
    expect(height).toBe(80);
  });

  it("never rounds a very thin edge down to zero", () => {
    // A 20000x3 sliver scales to 1600x0.24 — rounding that gives 0, which
    // would make the canvas unusable and throw during drawImage.
    const { height } = fitWithin(20000, 3, 1600);
    expect(height).toBeGreaterThanOrEqual(1);
  });

  it("defaults to the shared maximum dimension", () => {
    expect(fitWithin(5000, 5000)).toEqual({
      width: MAX_IMAGE_DIMENSION,
      height: MAX_IMAGE_DIMENSION,
      scaled: true,
    });
  });

  it("reports zero for a failed decode instead of dividing by zero", () => {
    expect(fitWithin(0, 0, 1600)).toEqual({ width: 0, height: 0, scaled: false });
  });
});
