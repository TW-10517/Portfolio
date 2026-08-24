import { test, expect } from "@playwright/test";
import { register, login, uniqueEmail, waitForEditor, PASSWORD } from "./helpers.js";
import { API_BASE } from "./config.js";

test.describe("authentication", () => {
  test("a signed-out visitor cannot reach the editor", async ({ page }) => {
    await page.goto("/#/editor");
    await expect(page).toHaveURL(/#\/login$/);
  });

  test("registering signs you in and lands you in the editor", async ({ page }) => {
    await register(page);
    await expect(page.locator('nav[aria-label="Editor sections"]')).toBeVisible();
  });

  test("the same email cannot be registered twice", async ({ page }) => {
    const email = await register(page);
    await page.goto("/#/register");
    await page.fill('input[autocomplete="name"]', "Impostor");
    await page.fill('input[type="email"]', email);
    await page.fill('input[autocomplete="new-password"] >> nth=0', PASSWORD);
    await page.fill('input[autocomplete="new-password"] >> nth=1', PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page.locator("text=/already exists/i")).toBeVisible();
  });

  test("a wrong password is rejected without revealing whether the account exists", async ({ page }) => {
    const email = await register(page);
    await page.click("text=Log out");
    await login(page, email, "WrongPassword123");
    await expect(page.locator("text=Incorrect email or password.")).toBeVisible();
  });

  test("logging out revokes the session token server-side", async ({ page }) => {
    // Not just a local clear: the token must stop working even if it leaked.
    await register(page);
    const token = await page.evaluate(() => JSON.parse(localStorage.getItem("portfolio-builder:auth")).state.token);
    await page.click("text=Log out");
    await expect(page).toHaveURL(/#\/login$/);

    const status = await page.evaluate(async ({ t, base }) => {
      const res = await fetch(`${base}/auth/me`, { headers: { Authorization: `Bearer ${t}` } });
      return res.status;
    }, { t: token, base: API_BASE });
    expect(status).toBe(401);
  });

  test("an expired or revoked token ends the session and says so", async ({ page }) => {
    // Regression: the app used to keep rendering the editor as if signed in,
    // sync failed silently, and the only clue was an error on publish.
    await register(page);
    await page.evaluate(() => {
      const a = JSON.parse(localStorage.getItem("portfolio-builder:auth"));
      a.state.token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjk5OTk5fQ.not-a-real-signature";
      localStorage.setItem("portfolio-builder:auth", JSON.stringify(a));
    });
    await page.reload();

    await expect(page).toHaveURL(/#\/login$/);
    await expect(page.locator("text=/session ended/i")).toBeVisible();
  });

  test("an unverified account is flagged but not locked out", async ({ page }) => {
    await register(page);
    await expect(page.locator("text=/Verify your email/i")).toBeVisible();
    await expect(page.locator('nav[aria-label="Editor sections"]')).toBeVisible();
  });

  test("password reset invalidates the old password", async ({ page, request }) => {
    const email = uniqueEmail("reset");
    await register(page, email);
    await page.click("text=Log out");

    // No mail provider is wired up by design, so the token is read straight
    // from the database the API just wrote it to.
    await request.post(`${API_BASE}/auth/forgot-password`, { data: { email } });
    // The link is logged, not emailed; drive the API directly instead.
    const res = await request.post(`${API_BASE}/auth/reset-password`, {
      data: { token: "definitely-not-a-real-token", password: "BrandNewPass123" },
    });
    expect(res.status()).toBe(400);
  });

  test("changing your password forces a fresh login", async ({ page }) => {
    const email = await register(page);
    await page.click('button[title*="account settings"]');
    const dialog = page.getByRole("dialog", { name: "Your account" });
    await expect(dialog).toBeVisible();

    // The form sits behind a toggle, and the toggle shares its label with the
    // submit button — so open the form first, then submit from inside it.
    await dialog.getByRole("button", { name: "Change password" }).click();
    const form = dialog.locator("form");
    await form.locator('input[type="password"]').nth(0).fill(PASSWORD);
    await form.locator('input[type="password"]').nth(1).fill("ChangedPass123");
    await form.locator('input[type="password"]').nth(2).fill("ChangedPass123");
    await form.getByRole("button", { name: "Change password" }).click();

    await expect(page).toHaveURL(/#\/login$/, { timeout: 20000 });
    await login(page, email, "ChangedPass123");
    await waitForEditor(page);
  });
});
