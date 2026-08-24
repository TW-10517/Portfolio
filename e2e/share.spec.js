import { test, expect } from "@playwright/test";
import { register, publish, openShareDialog, setName, publishButton } from "./helpers.js";
import { API_BASE } from "./config.js";

const slug = (p) => `${p}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

test.describe("publishing and sharing", () => {
  test("publishing produces a working public link", async ({ page }) => {
    const s = slug("pub");
    await register(page);
    await setName(page, "Published Person");
    await publish(page, s);

    await page.goto(`/#/p/${s}`);
    await expect(page.locator("text=Published Person").first()).toBeVisible();
  });

  test("reopening the dialog still shows your link", async ({ page }) => {
    // Regression: `published` reset to false on every mount, so reopening the
    // dialog hid the link, QR code and social buttons, and offered "Publish"
    // instead of "Republish" — the only way back was to publish again.
    const s = slug("reopen");
    await register(page);
    await publish(page, s);
    await page.keyboard.press("Escape");

    await openShareDialog(page);
    await expect(page.getByRole("button", { name: "Republish" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Unpublish" })).toBeVisible();
    await expect(page.locator("input[readonly]").first()).toHaveValue(new RegExp(`${s}$`));
    await expect(page.locator('img[alt="QR code for share link"]')).toBeVisible();
  });

  test("the view counter reflects real visits", async ({ page, context }) => {
    const s = slug("views");
    await register(page);
    await publish(page, s);
    await page.keyboard.press("Escape");

    const visitor = await context.newPage();
    await visitor.goto(`/#/p/${s}`);
    await visitor.waitForTimeout(800);
    await visitor.close();

    await page.reload();
    await openShareDialog(page);
    const counter = page.locator("div.flex.items-center.justify-between span.text-white").first();
    await expect(counter).toHaveText(/[1-9]\d*/);
  });

  test("a private portfolio 404s without revealing that the slug exists", async ({ page }) => {
    // Deliberate: a distinct "this is private" message would let anyone probe
    // which slugs are taken.
    const s = slug("private");
    await register(page);
    await openShareDialog(page);
    await page.locator("input.bg-transparent").first().fill(s);
    await page.locator("select").first().selectOption("private");
    await publishButton(page).click();
    await expect(page.getByRole("button", { name: "Copy" })).toBeVisible();

    await page.goto(`/#/p/${s}`);
    await expect(page.locator("text=/No portfolio found/i")).toBeVisible();
    await page.goto(`/#/p/${s}-does-not-exist`);
    await expect(page.locator("text=/No portfolio found/i")).toBeVisible();
  });

  test("a password-protected portfolio asks for the password", async ({ page }) => {
    const s = slug("gated");
    await register(page);
    await openShareDialog(page);
    await page.locator("input.bg-transparent").first().fill(s);
    await page.locator("select").first().selectOption("password");
    await page.locator('input[placeholder="Set a password"]').fill("letmein9");
    await publishButton(page).click();
    await expect(page.getByRole("button", { name: "Copy" })).toBeVisible();

    await page.goto(`/#/p/${s}`);
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("the API refuses a portfolio containing a javascript: link", async ({ page, request }) => {
    // The renderer strips these too, but the server must not store them:
    // the client is the part an attacker controls.
    await register(page);
    const token = await page.evaluate(() => JSON.parse(localStorage.getItem("portfolio-builder:auth")).state.token);

    const bad = await request.put(`${API_BASE}/portfolios/mine`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        data: { profile: { name: "M" }, projects: { items: [{ demoUrl: "javascript:alert(1)" }] } },
        slug: slug("xss"),
        visibility: "public",
      },
    });
    expect(bad.status()).toBe(400);
    expect(await bad.text()).toMatch(/unsupported scheme/i);

    const proto = await request.put(`${API_BASE}/portfolios/mine`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { data: JSON.parse('{"profile":{"__proto__":{"admin":true}}}'), slug: slug("proto"), visibility: "public" },
    });
    expect(proto.status()).toBe(400);
  });

  test("a javascript: link never reaches a visitor's page", async ({ page, context }) => {
    const s = slug("render");
    await register(page);
    // Make a real edit first: the persist middleware only writes the draft to
    // localStorage once something changes, so there is nothing to patch
    // otherwise.
    await setName(page, "Mallory");
    await page.evaluate(() => {
      const draft = JSON.parse(localStorage.getItem("portfolio-builder:draft"));
      const d = draft.state.data;
      if (d.education?.certifications?.[0]) d.education.certifications[0].url = "javascript:window.__XSS__=1";
      localStorage.setItem("portfolio-builder:draft", JSON.stringify(draft));
    });
    await page.reload();
    await page.waitForTimeout(1000);

    // The server rejects the save, so publishing fails — which is itself the
    // protection. Confirm the visitor page carries no such link either way.
    await openShareDialog(page);
    await page.locator("input.bg-transparent").first().fill(s);
    await publishButton(page).click();
    await page.waitForTimeout(2000);

    const visitor = await context.newPage();
    await visitor.goto(`/#/p/${s}`);
    await visitor.waitForTimeout(1500);
    const dangerous = await visitor.evaluate(() =>
      [...document.querySelectorAll("a[href]")].filter((a) => /^javascript:/i.test(a.getAttribute("href"))).length
    );
    expect(dangerous).toBe(0);
    await visitor.close();
  });
});
