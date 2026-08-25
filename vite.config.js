import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    // Node is the right default: most suites test pure functions or drive the
    // Express app over supertest. Component suites opt into a DOM per-file
    // with a `@vitest-environment jsdom` docblock, so the fast majority stay
    // out of jsdom's startup cost.
    environment: "node",
    // Testing Library registers its own afterEach unmount hook, which it can
    // only do when the lifecycle helpers are globals. Without this, component
    // state leaks between tests.
    globals: true,
    setupFiles: ["./test/setup.js"],
    // e2e/*.spec.js belong to Playwright. Vitest's default include globs
    // match them too, and importing @playwright/test outside a Playwright
    // runner throws, so `npm test` reported six phantom failures.
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"],
  },
});
