import { test, expect } from "@playwright/test";
import { register } from "./helpers.js";
import { API_ORIGIN } from "./config.js";

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

  test("an oversized image is stored on the server, not inside the portfolio", async ({ page, request }) => {
    // A straight-from-the-camera photo used to be base64'd into the portfolio
    // JSON, where enough of them pushed the document past the API's body cap
    // with no way out. Driven through the real upload control rather than by
    // importing the module: the suite runs against a production bundle, where
    // /src paths don't exist.
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
      // The default portfolio ships a placeholder photo, so "truthy" isn't the
      // signal — wait for a stored-image URL specifically. Matching on "not
      // the placeholder" broke the moment the placeholder stopped being a
      // placehold.co link and became an inline SVG: the test would have read
      // the default and called it the upload.
      const read = () => {
        const v = JSON.parse(localStorage.getItem("portfolio-builder:draft") || "null")
          ?.state?.data?.profile?.photo;
        return typeof v === "string" && v.startsWith("/api/images/") ? v : null;
      };
      for (let i = 0; i < 100 && !read(); i += 1) {
        await new Promise((r) => setTimeout(r, 100));
      }
      return read();
    });
    expect(photo, "the upload never reached the store").toBeTruthy();

    // The draft holds a short URL, not megabytes of base64. This is the whole
    // point: the portfolio JSON used to grow by the size of every photo, and
    // enough of them made it impossible to save at all.
    expect(photo).toMatch(/^\/api\/images\/[0-9a-f]{64}\.[a-z]+$/);

    const stored = await request.get(`${API_ORIGIN}${photo}`);
    expect(stored.status()).toBe(200);
    expect(stored.headers()["cache-control"]).toContain("immutable");
    const storedBytes = (await stored.body()).length;
    expect(storedBytes).toBeLessThan(buffer.length / 3);

    // And it renders — resolved back to an absolute URL against the API.
    const dims = await page.evaluate(
      (src) =>
        new Promise((res) => {
          const i = new Image();
          i.onload = () => res([i.naturalWidth, i.naturalHeight]);
          i.onerror = () => res(null);
          i.src = src;
        }),
      `${API_ORIGIN}${photo}`
    );
    // 1600 is MAX_IMAGE_DIMENSION in src/utils/exportImport.js.
    expect(dims).toEqual([1600, 1067]);
  });

  test("a failed import explains itself instead of freezing the page", async ({ page }) => {
    // These used to be window.alert(). An alert blocks the page until it is
    // dismissed, can't be styled, reads as a browser failure rather than as
    // this app telling you something — and some browsers suppress it outright,
    // which turns "here is why nothing happened" into nothing happening.
    await register(page);

    await page.locator('input[type="file"][accept="application/json"]').setInputFiles({
      name: "not-a-portfolio.json",
      mimeType: "application/json",
      buffer: Buffer.from("{ this is not json at all"),
    });

    const notice = page.getByRole("alert").filter({ hasText: /portfolio export/i });
    await expect(notice).toBeVisible();
    // Announced, not just drawn.
    await expect(notice).toHaveAttribute("aria-live", "assertive");

    // And the page is still usable rather than blocked behind a dialog.
    await page.click("text=Skills");
    await expect(page.locator("main h2").first()).toBeVisible();

    await notice.getByRole("button", { name: "Dismiss" }).click();
    await expect(notice).toHaveCount(0);
  });
});