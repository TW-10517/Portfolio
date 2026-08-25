import { expect } from "@playwright/test";

let counter = 0;

// Every run registers throwaway accounts. `npm run db:clear-test-users`
// removes them; the @example.com domain is what marks them as disposable.
export function uniqueEmail(prefix = "e2e") {
  counter += 1;
  return `${prefix}_${Date.now()}_${counter}@example.com`;
}

export const PASSWORD = "TestPass123";

// The editor route is lazy-loaded, so landing on the URL is not the same as
// the editor being on screen — waiting for the URL alone lands on the
// Suspense fallback and reads an empty page.
export async function waitForEditor(page) {
  // Race the redirect against the form's error banner. Waiting on the URL
  // alone meant a rejected submit (a 429, a duplicate address) sat there
  // until the test timeout — five minutes of nothing, and a failure message
  // that named the navigation rather than the reason.
  const failed = page.getByRole("alert").first();
  const NEVER = new Promise(() => {});
  await Promise.race([
    page.waitForURL("**/#/editor"),
    failed.waitFor({ state: "visible", timeout: 30_000 }).then(
      async () => {
        throw new Error(`Auth form rejected the submit: ${await failed.innerText()}`);
      },
      // No banner within 30s just means this isn't the failure mode; hand
      // back a promise that never settles so the race is decided by the
      // navigation, and nothing rejects after the test has moved on.
      () => NEVER
    ),
  ]);
  await expect(page.locator('nav[aria-label="Editor sections"]')).toBeVisible();
}

export async function register(page, email = uniqueEmail(), name = "E2E User") {
  await page.goto("/#/register");
  await page.fill('input[autocomplete="name"]', name);
  await page.fill('input[type="email"]', email);
  await page.fill('input[autocomplete="new-password"] >> nth=0', PASSWORD);
  await page.fill('input[autocomplete="new-password"] >> nth=1', PASSWORD);
  await page.click('button[type="submit"]');
  await waitForEditor(page);
  return email;
}

export async function login(page, email, password = PASSWORD) {
  await page.goto("/#/login");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
}

// The share dialog checks publish state on open, so the primary button is
// briefly "Checking…". Clicking before it settles hits the wrong control.
export function publishButton(page) {
  // Exact match: has-text("Publish") is a substring test and also matches the
  // "Unpublish" button sitting right beside it.
  return page.getByRole("button", { name: /^(Publish|Republish)$/ });
}

export async function openShareDialog(page) {
  await page.click("text=Share ↗");
  await expect(page.getByRole("dialog", { name: "Share your portfolio" })).toBeVisible();
  await expect(publishButton(page)).toBeVisible();
}

export async function publish(page, slug) {
  await openShareDialog(page);
  if (slug) await page.locator("input.bg-transparent").first().fill(slug);
  await publishButton(page).click();
  await expect(page.getByRole("button", { name: "Copy" })).toBeVisible();
}

// Edits the Full Name field, which every spec uses as its canary value.
export async function setName(page, value) {
  await page.click("text=Profile");
  await page.locator("input:visible").first().fill(value);
  await page.waitForTimeout(400); // let the debounced store write settle
}
