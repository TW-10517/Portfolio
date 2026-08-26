import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
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
const API_HOST_PLACEHOLDER = "https://YOUR-API-HOST";

// The API lives somewhere different in every deployment, so `public/_headers`
// ships a placeholder. Leaving it for a human to replace by hand is a step that
// gets forgotten exactly once, and the symptom is the deployed frontend being
// unable to reach its own API — so it is resolved from VITE_API_URL, which the
// build already needs for the same reason.
function withApiHost(text) {
  const api = process.env.VITE_API_URL;
  if (!api) return text.replaceAll(` ${API_HOST_PLACEHOLDER}`, "");
  return text.replaceAll(API_HOST_PLACEHOLDER, new URL(api, "http://localhost").origin);
}

// Rewrites the copy Vite emits into dist/, so what the static host serves has a
// real host in it rather than the placeholder.
function resolveApiHostInHeaders() {
  let outDir = "dist";
  return {
    name: "resolve-api-host-in-headers",
    apply: "build",
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const emitted = resolve(outDir, "_headers");
      if (!existsSync(emitted)) return;
      const text = readFileSync(emitted, "utf8");
      writeFileSync(emitted, withApiHost(text));
      if (!process.env.VITE_API_URL) {
        // Not fatal: a build for a frontend served from the same origin as the
        // API genuinely needs no entry. Said out loud because the other reason
        // to see this is forgetting to set it, and that ships a policy that
        // blocks every API call the app makes.
        this.warn(
          "VITE_API_URL is unset, so dist/_headers names no API host. " +
            "The frontend can only reach an API on its own origin."
        );
      }
    },
  };
}

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

  const csp = "Content-Security-Policy";
  if (out[csp]) out[csp] = withApiHost(out[csp]);

  // Sent over a plain-HTTP preview it would pin localhost to HTTPS in the
  // developer's own browser, which is genuinely annoying to undo.
  delete out["Strict-Transport-Security"];
  return out;
}

export default defineConfig({
  plugins: [react(), resolveApiHostInHeaders()],
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
