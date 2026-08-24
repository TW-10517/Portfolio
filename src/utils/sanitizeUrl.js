// Portfolio URLs are author-supplied and are rendered into `href` for anyone
// who opens the public share link. Without a check, an author could store
// `javascript:…` and have it served to every visitor — React only warns about
// those, it doesn't block them, and a future React version blocking them is
// not a security model we should depend on. Everything user-controlled that
// reaches an `href` goes through here first.

const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

// The resume is stored inline as a base64 PDF and offered as a download, so
// that one case needs `data:` — narrowly, and only for PDFs.
const PDF_DATA_URL = /^data:application\/pdf[;,]/i;

// Browsers ignore control characters when resolving a URL, so "java\tscript:"
// navigates exactly like "javascript:". Strip them before parsing or the
// scheme check can be walked straight past.
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/g;

/**
 * Returns a URL safe to place in an href, or `undefined` if it isn't.
 * `undefined` is deliberate: React omits the attribute entirely, so a
 * rejected URL renders as a non-link rather than a broken or dangerous one.
 */
export function sanitizeUrl(raw, { allowPdfData = false } = {}) {
  if (raw == null) return undefined;
  const cleaned = String(raw).replace(CONTROL_CHARS, "").trim();
  if (!cleaned) return undefined;

  if (PDF_DATA_URL.test(cleaned)) return allowPdfData ? cleaned : undefined;

  // In-page anchors and site-relative paths never carry a scheme, so they
  // can't smuggle one. "//evil.com" is protocol-relative and *is* off-site,
  // so it has to go through the parser like any absolute URL.
  if (cleaned.startsWith("#")) return cleaned;
  if (cleaned.startsWith("/") && !cleaned.startsWith("//")) return cleaned;

  let url;
  try {
    url = new URL(cleaned);
  } catch {
    // No scheme at all — people type "example.com/me", not "https://…".
    // Upgrading to https is safe because the result is re-checked below.
    try {
      url = new URL(`https://${cleaned}`);
    } catch {
      return undefined;
    }
  }

  return SAFE_PROTOCOLS.has(url.protocol) ? url.href : undefined;
}

// Convenience for the resume download link.
export function sanitizeDownloadUrl(raw) {
  return sanitizeUrl(raw, { allowPdfData: true });
}
