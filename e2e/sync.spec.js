import { test, expect } from "@playwright/test";
import { register, login, publish, setName, waitForEditor, uniqueEmail, PASSWORD } from "./helpers.js";

const firstField = (page) => page.locator("input:visible").first();

test.describe("draft persistence and sync", () => {
  test("an unsaved edit survives a page refresh", async ({ page }) => {
    await register(page);
    await setName(page, "UNSAVED LOCAL EDIT");
    await page.reload();
    await waitForEditor(page);
    await page.click("text=Profile");
    await expect(firstField(page)).toHaveValue("UNSAVED LOCAL EDIT");
  });

  test("a refresh does not overwrite local edits with the published copy", async ({ page }) => {
    // Regression: loadFromServer runs on every editor mount, including plain
    // refreshes. A blind overwrite discarded everything edited since the last
    // publish.
    await register(page);
    await setName(page, "PUBLISHED VERSION");
    await publish(page, `sync-${Date.now()}`);
    await page.keyboard.press("Escape");

    await setName(page, "EDITED AFTER PUBLISH");
    await page.reload();
    await waitForEditor(page);
    await page.click("text=Profile");
    await expect(firstField(page)).toHaveValue("EDITED AFTER PUBLISH");
  });

  test("signing in on another device loads the published portfolio", async ({ page, browser }) => {
    const email = uniqueEmail("sync");
    await register(page, email);
    await setName(page, "DEVICE A EDIT");
    await publish(page, `device-${Date.now()}`);

    const other = await browser.newContext();
    const b = await other.newPage();
    await login(b, email, PASSWORD);
    await waitForEditor(b);
    await b.click("text=Profile");
    await expect(firstField(b)).toHaveValue("DEVICE A EDIT");
    await other.close();
  });

  test("logging out clears the draft so the next account starts clean", async ({ page }) => {
    // The draft is per-browser, not per-account. Without clearing it, the
    // next user's real server data is blocked by the previous user's leftover
    // edits looking "newer".
    await register(page);
    await setName(page, "FIRST USER DRAFT");
    await page.click("text=Log out");
    await expect(page).toHaveURL(/#\/login$/);

    await register(page, uniqueEmail("second"));
    await page.click("text=Profile");
    await expect(firstField(page)).not.toHaveValue("FIRST USER DRAFT");
  });
});
