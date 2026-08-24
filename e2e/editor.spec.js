import { test, expect } from "@playwright/test";
import { register } from "./helpers.js";

const TABS = [
  "Profile", "About Me", "Skills", "Experience", "Projects",
  "Education", "Testimonials", "Blog", "Contact", "Theme & Design",
];

test.describe("editor", () => {
  test("every tab renders without a page error", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

    await register(page);
    for (const tab of TABS) {
      await page.click(`text=${tab}`);
      await expect(page.locator("main h2").first()).toBeVisible();
    }
    expect(errors).toEqual([]);
  });

  test("edits appear in the live preview", async ({ page }) => {
    await register(page);
    await page.click("text=Profile");
    await page.locator("input:visible").first().fill("Preview Sync Name");
    await expect(page.locator('section[aria-label="Portfolio preview"]')).toContainText("Preview Sync Name");
  });

  test("the visitor preview opens as a standalone page", async ({ page }) => {
    await register(page);
    await page.goto("/#/preview");
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator('aside[aria-label="Preview notice"]')).toBeVisible();
  });

  test("an oversized image is downscaled rather than rejected", async ({ page }) => {
    // Portfolios are stored as JSON with images inline, so a straight-from-the
    // -camera photo used to push the document past the API's size cap.
    await register(page);
    const result = await page.evaluate(async () => {
      const mod = await import("/src/utils/exportImport.js");
      const c = document.createElement("canvas");
      c.width = 3000;
      c.height = 2000;
      const ctx = c.getContext("2d");
      const img = ctx.createImageData(c.width, c.height);
      for (let i = 0; i < img.data.length; i += 4) {
        img.data[i] = (i * 7) % 255;
        img.data[i + 1] = (i * 13) % 255;
        img.data[i + 2] = (i * 29) % 255;
        img.data[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      const original = c.toDataURL("image/png");
      const shrunk = await mod.downscaleDataUrl(original);
      const dims = await new Promise((res) => {
        const i = new Image();
        i.onload = () => res([i.naturalWidth, i.naturalHeight]);
        i.src = shrunk;
      });
      return { originalBytes: original.length, shrunkBytes: shrunk.length, dims, max: mod.MAX_IMAGE_DIMENSION };
    });

    expect(result.dims[0]).toBe(result.max);
    expect(result.shrunkBytes).toBeLessThan(result.originalBytes / 3);
  });
});
