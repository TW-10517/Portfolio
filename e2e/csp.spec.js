import { test, expect } from "@playwright/test";
import { register, setName } from "./helpers.js";

// A Content-Security-Policy nobody has run the app under is a guess, and the
// failure mode of getting it wrong is not a warning — it is a blank page, in
// production, for everyone.
//
// `public/_headers` is the file the static host serves. vite.config.js parses
// it into `preview.headers`, so the server this whole suite runs against is
// already sending the production policy: every other spec here is a CSP test
// too, and this one says so out loud.

const violations = (page) => page.evaluate(() => window.__csp ?? []);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => {
      window.__csp.push(`${e.effectiveDirective} blocked ${e.blockedURI}`);
    });
  });
});

test("the headers the host will send are the ones being served", async ({ page }) => {
  const response = await page.goto("/#/login");
  const headers = response.headers();
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["content-security-policy"]).toContain("script-src 'self'");
  // The two that would quietly hand back everything the policy is for.
  expect(headers["content-security-policy"]).not.toContain("unsafe-eval");
  expect(headers["content-security-policy"]).not.toContain("script-src 'self' 'unsafe-inline'");
});

test("the policy is in force, not merely present", async ({ page }) => {
  // A policy that blocks nothing would pass every other assertion here, so
  // try the exact thing it exists to stop.
  await page.goto("/#/login");
  await page.evaluate(() => {
    const s = document.createElement("script");
    s.textContent = "window.__injected = true;";
    document.body.appendChild(s);
  });

  expect(await page.evaluate(() => window.__injected)).toBeUndefined();
  expect((await violations(page)).join(" ")).toContain("script-src-elem");
});

test("and the app still runs clean under it", async ({ page }) => {
  await register(page);

  // Touch the parts with the most to lose: the theme system's injected font
  // stylesheet and its inline style attributes, and a save that has to reach
  // an API on a different origin.
  await setName(page, "CSP Check");
  await page.click("text=Design");
  await expect(page.locator("main, aside").first()).toBeVisible();

  expect(await violations(page), "the app must run clean under its own CSP").toEqual([]);
});
