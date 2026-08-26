import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// `public/_headers` is what the static host sends in production. `vite preview`
// does not read it, so a Content-Security-Policy that breaks the app would
// first be discovered by visitors, as a blank page. Parsing the same file here
// means `npm run preview` — and the browser suite, which runs against exactly
// this server — exercises the policy that ships.
//
// Deliberately not applied to the dev server: HMR injects inline script, so
// `script-src 'self'` would break the thing developers use all day, and
// weakening the policy to accommodate that would stop it testing anything.
function headersFromFile() {
  const file = fileURLToPath(new URL("./public/_headers", import.meta.url));
  const out = {};
  let inWildcardBlock = false;
  for (const raw of readFileSync(file, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("/")) {
      inWildcardBlock = line === "/*";
      continue;
    }
    if (!inWildcardBlock) continue;
    const at = line.indexOf(":");
    if (at > 0) out[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }

  // The API lives somewhere different in every deployment, so the file ships a
  // placeholder. Here it is whatever the build was pointed at.
  const csp = "Content-Security-Policy";
  if (out[csp]) {
    const api = process.env.VITE_API_URL;
    const origin = api ? new URL(api, "http://localhost").origin : "";
    out[csp] = origin
      ? out[csp].replaceAll("https://YOUR-API-HOST", origin)
      : out[csp].replaceAll(" https://YOUR-API-HOST", "");
  }

  // Sent over a plain-HTTP preview it would pin localhost to HTTPS in the
  // developer's own browser, which is genuinely annoying to undo.
  delete out["Strict-Transport-Security"];
  return out;
}

export default defineConfig({
  plugins: [react()],
  preview: { headers: headersFromFile() },
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
