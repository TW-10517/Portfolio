import { defineConfig, devices } from "@playwright/test";
import { API_PORT, WEB_PORT, API_ORIGIN, WEB_ORIGIN, API_BASE } from "./e2e/config.js";

// These suites drive a real browser against both servers. They exist because
// almost every serious bug in this project — narration cut off mid sentence,
// exports that claimed to have audio and didn't, a share modal that hid your
// own link, focus escaping a dialog — was invisible to unit tests and only
// showed up in a real browser.
//
// Everything runs on its own ports against its own database file, so a test
// run never touches the dev database, never consumes the dev server's rate
// limit budget, and starts from a clean slate every time. (Rate limits are
// persisted now, so sharing a database with the dev server meant repeated
// runs eventually tripped the registration limiter and every spec failed.)
const WEB = WEB_ORIGIN;
const API = API_ORIGIN;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.js",
  // SQLite has a single writer and specs register accounts against a shared
  // rate limit, so keep concurrency low.
  workers: 2,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: WEB,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npm run dev:server",
      url: `${API}/api/health`,
      // Always start a fresh one: reusing a running dev server would silently
      // ignore the isolated database and ports below.
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        PORT: String(API_PORT),
        DATABASE_URL: "./server/e2e.sqlite",
        JWT_SECRET: "e2e-only-secret-not-used-in-production",
        // ~35 registrations per run from one address; the production budget is 30.
        RATE_LIMIT_SCALE: "20",
        CORS_ORIGIN: WEB,
      },
    },
    {
      // A production build served by `vite preview`, not the dev server.
      // Vite transforms modules on demand, so under two workers a cold lazy
      // chunk could take long enough that assertions timed out waiting for
      // the editor — a flake with no bug behind it. This also means the
      // suite exercises the bundle users actually download. VITE_API_URL is
      // inlined at build time, so it belongs on the build, not the serve.
      command: `npm run build && npm run preview -- --port ${WEB_PORT} --strictPort`,
      url: WEB,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { VITE_API_URL: API_BASE },
    },
  ],
});
