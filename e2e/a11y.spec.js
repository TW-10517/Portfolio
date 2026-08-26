import { test, expect } from "@playwright/test";
import fs from "fs";
import { createRequire } from "module";
import { register } from "./helpers.js";

const require = createRequire(import.meta.url);
const AXE = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

// Automated checks catch contrast, labelling and landmark problems. They can't
// see keyboard behaviour, so the dialog focus trap is asserted separately
// below and in src/components/ui/Modal.test.jsx.
// Injected before the page's own scripts rather than appended as a <script>
// element afterwards. The preview server sends the production CSP (see
// vite.config.js), and `script-src 'self'` blocks an inline script tag —
// correctly, since that is the whole point of it. An init script goes in
// through the debugger protocol, so the test harness stays out of the way of
// the policy it is meant to be testing under.
test.beforeEach(async ({ page }) => {
  await page.addInitScript({ content: AXE });
});

async function violations(page) {
  return page.evaluate(async () => {
    const res = await window.axe.run(document, { resultTypes: ["violations"] });
    return res.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.slice(0, 3).map((n) => n.target.join(" ")),
    }));
  });
}

const report = (list) => list.map((v) => `[${v.impact}] ${v.id} — ${v.help} (${v.nodes.join(", ")})`).join("\n");

test.describe("accessibility", () => {
  test("the login page has no violations", async ({ page }) => {
    await page.goto("/#/login");
    await expect(page.locator("form")).toBeVisible();
    const found = await violations(page);
    expect(report(found)).toBe("");
  });

  test("the editor has no violations", async ({ page }) => {
    await register(page);
    await page.waitForTimeout(1500);
    const found = await violations(page);
    expect(report(found)).toBe("");
  });

  test("the rendered portfolio has no violations", async ({ page }) => {
    await register(page);
    await page.goto("/#/preview");
    await page.waitForTimeout(2000);
    const found = await violations(page);
    expect(report(found)).toBe("");
  });

  test("a dialog traps focus and gives it back", async ({ page }) => {
    // Regression: Tab used to walk straight out of an open dialog into the
    // page behind it — "Log out" was two stops from an open Share dialog.
    await register(page);
    const trigger = page.locator("text=Share ↗");
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Share your portfolio" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");

    for (let i = 0; i < 15; i++) {
      await page.keyboard.press("Tab");
      const inside = await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
      expect(inside).toBe(true);
    }

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    const returned = await page.evaluate(() => (document.activeElement?.textContent || "").trim());
    expect(returned).toContain("Share");
  });
});
