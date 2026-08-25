import { API_BASE } from "./api.js";

// Uploaded images are stored in the portfolio as a relative path
// (/api/images/<hash>.webp) rather than an absolute URL, so a portfolio built
// against localhost still renders when the same document is served from
// production. The trade-off is that the path has to be resolved against the
// API's origin at the moment it is rendered — which is what this does.
//
// Everything else passes through untouched: http(s) URLs the author typed,
// the placeholder images in the default portfolio, and inline data: URLs
// (which is what an upload still is when the server can't be reached).
const STORED_IMAGE = /^\/api\/images\//;

export function resolveImageUrl(src, base = API_BASE) {
  if (typeof src !== "string" || !STORED_IMAGE.test(src)) return src;
  const origin = String(base).replace(/\/+$/, "").replace(/\/api$/, "");
  return `${origin}${src}`;
}

export function isStoredImage(src) {
  return typeof src === "string" && STORED_IMAGE.test(src);
}
