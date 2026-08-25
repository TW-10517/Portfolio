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
    // -camera photo used to push the document past the API's size cap. Driven
    // through the real upload control rather than by importing the module:
    // the suite runs against a production bundle, where /src paths don't exist.
    await register(page);
    await page.click("text=Profile");

    // A gradient with mild noise, encoded as JPEG — roughly what comes off a
    // phone. A flat fill would compress to nothing and the size assertion
    // below would pass for the wrong reason; pure noise makes a PNG so large
    // the component's own 12MB guard rejects it before any downscaling.
    const dataUrl = await page.evaluate(async () => {
      const c = document.createElement("canvas");
      c.width = 3000;
      c.height = 2000;
      const ctx = c.getContext("2d");
      const img = ctx.createImageData(c.width, c.height);
      for (let i = 0; i < img.data.length; i += 4) {
        const base = (((i / 4) % c.width) / c.width) * 200;
        img.data[i] = base + ((i * 7) % 55);
        img.data[i + 1] = base + ((i * 13) % 55);
        img.data[i + 2] = 255 - base;
        img.data[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      return c.toDataURL("image/jpeg", 0.9);
    });
    const buffer = Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");

    const upload = page.locator('input[type="file"][accept="image/*"]').first();
    await upload.setInputFiles({ name: "huge.jpg", mimeType: "image/jpeg", buffer });

    const photo = await page.evaluate(async () => {
      // The default portfolio ships a placeholder photo URL, so "truthy" isn't
      // the signal — wait for it to become an inline data URL.
      const read = () => {
        const v = JSON.parse(localStorage.getItem("portfolio-builder:draft") || "null")
          ?.state?.data?.profile?.photo;
        return typeof v === "string" && v.startsWith("data:") ? v : null;
      };
      for (let i = 0; i < 100 && !read(); i += 1) {
        await new Promise((r) => setTimeout(r, 100));
      }
      return read();
    });
    expect(photo, "the upload never reached the store").toBeTruthy();

    const dims = await page.evaluate(
      (src) =>
        new Promise((res) => {
          const i = new Image();
          i.onload = () => res([i.naturalWidth, i.naturalHeight]);
          i.src = src;
        }),
      photo
    );

    // 1600 is MAX_IMAGE_DIMENSION in src/utils/exportImport.js.
    expect(dims).toEqual([1600, 1067]);
    // Base64 costs ~4/3, so compare decoded bytes against the uploaded file.
    const storedBytes = (photo.length - photo.indexOf(",") - 1) * 0.75;
    expect(storedBytes).toBeLessThan(buffer.length / 3);
  });
});
