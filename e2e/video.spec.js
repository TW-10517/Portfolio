import { test, expect } from "@playwright/test";
import { register } from "./helpers.js";

// The studio writes a script on open. With a local model available that takes
// a while; with none it falls back to the built-in offline writer and is
// nearly instant. CI has no model, so the fallback path is what runs there.
const SCRIPT_READY = 180_000;

test.describe("AI video studio", () => {
  test.setTimeout(300_000);

  test("generates a script and renders a non-blank frame", async ({ page }) => {
    await register(page);
    await page.click("text=🎬 AI Video");

    await expect(page.locator("text=/scripted via/")).toBeVisible({ timeout: SCRIPT_READY });

    const meta = await page.locator("text=/scripted via/").first().textContent();
    expect(meta).toMatch(/~\d+s/);
    expect(meta).toMatch(/\d+ scenes?/);

    const painted = await page.evaluate(() => {
      const c = document.querySelector("canvas");
      if (!c) return false;
      const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      for (let i = 0; i < d.length; i += 4000) if (d[i] || d[i + 1] || d[i + 2]) return true;
      return false;
    });
    expect(painted).toBe(true);
  });

  test("offers a clearly labelled export control", async ({ page }) => {
    // Regression: a restructure left this as a bare "⬇ MP4" with no tooltip.
    await register(page);
    await page.click("text=🎬 AI Video");
    await expect(page.locator("text=/scripted via/")).toBeVisible({ timeout: SCRIPT_READY });

    const exportBtn = page.locator('button[title*="Download this video"]');
    await expect(exportBtn).toBeVisible();
    await expect(exportBtn).toContainText(/Export (MP4|WebM)/);
  });

  test("editing a scene's duration retimes the video", async ({ page }) => {
    await register(page);
    await page.click("text=🎬 AI Video");
    await expect(page.locator("text=/scripted via/")).toBeVisible({ timeout: SCRIPT_READY });

    const before = await page.locator("text=/scripted via/").first().textContent();
    const duration = page.locator('input[id^="scene-duration-"]').first();
    await duration.fill("30");
    await duration.blur();
    await page.waitForTimeout(800);

    const after = await page.locator("text=/scripted via/").first().textContent();
    expect(after).not.toBe(before);
  });

  test("playback starts and can be stopped", async ({ page }) => {
    await register(page);
    await page.click("text=🎬 AI Video");
    await expect(page.locator("text=/scripted via/")).toBeVisible({ timeout: SCRIPT_READY });

    await page.locator('button[title="Play"]').first().click();
    await expect(page.locator('button[title="Stop"]').first()).toBeVisible();
    await page.locator('button[title="Stop"]').first().click();
    await expect(page.locator('button[title="Play"]').first()).toBeVisible();
  });
});
