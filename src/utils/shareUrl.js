import { API_BASE } from "./api.js";
import { slugify } from "./slug.js";

// Share links point at the API server, not at the static frontend.
//
// That looks like a detour, but it is the only place a per-portfolio link
// preview can come from: Slack, LinkedIn, WhatsApp and iMessage read <head>
// without running JavaScript, and a static host has no way to vary its tags
// per slug. The API answers /p/:slug with that portfolio's real title,
// description and image, then bounces the human to #/p/:slug in the app.
//
// When the API is served from the same origin as the app — the usual single
// host deployment — this is simply the app's own URL and there is no hop at
// all.
export function shareOrigin(base = API_BASE, fallbackOrigin = "") {
  const stripped = String(base).replace(/\/+$/, "").replace(/\/api$/, "");
  try {
    return new URL(stripped, fallbackOrigin || undefined).origin;
  } catch {
    // A relative VITE_API_URL ("/api") has no origin of its own; it means
    // "wherever the app is served from".
    return String(fallbackOrigin).replace(/\/+$/, "");
  }
}

export function shareUrlFor(slug, { base = API_BASE, origin = "" } = {}) {
  return `${shareOrigin(base, origin)}/p/${slugify(slug)}`;
}
