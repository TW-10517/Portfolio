// Per-portfolio link previews.
//
// A shared portfolio lives at #/p/:slug. The fragment is never sent to the
// server, and the Slack/LinkedIn/WhatsApp/iMessage crawlers don't run
// JavaScript, so every share link used to preview identically as "Portfolio
// Builder" no matter whose portfolio it was.
//
// The fix does not need the whole app server-rendered. A crawler only reads
// <head>, so the server answers /p/:slug with a small document carrying that
// portfolio's real metadata and bounces a human straight on to the app. The
// portfolio itself is still rendered entirely in the browser.

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

// Everything interpolated below is author-supplied, and og:title lands inside
// an attribute that a crawler re-renders elsewhere. Escaping the quote
// characters as well as the angle brackets is what keeps a name like
// `" /><script>` from breaking out of the tag.
export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

// Preview text is read in a crawler's card, not on a page that can scroll:
// past roughly this much every consumer truncates anyway, and doing it here
// means we choose where the cut lands.
function clamp(text, max) {
  const flat = String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[,;:.\s]+$/, "")}…`;
}

// og:image has to be an absolute http(s) URL that the crawler can fetch on its
// own. An uploaded photo is stored as a path relative to this server, so it
// only needs the origin putting back; an inline data: URL is silently dropped
// by every consumer, so there is no point emitting one.
function absoluteImage(photo, origin) {
  if (typeof photo !== "string") return null;
  const trimmed = photo.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (origin && /^\/api\/images\/[0-9a-f]{64}(\.[a-z]{3,4})?$/.test(trimmed)) return `${origin}${trimmed}`;
  return null;
}

function describe(profile, about) {
  const roles = String(profile.roles ?? "")
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);
  const parts = [];
  if (profile.tagline) parts.push(profile.tagline);
  else if (about?.summary) parts.push(about.summary);
  else if (roles.length) parts.push(roles.join(" · "));
  if (profile.location) parts.push(profile.location);
  return clamp(parts.join(" — "), 200) || "A portfolio built with Portfolio Builder.";
}

// A private or password-protected portfolio must preview as blandly as a slug
// that doesn't exist. Anything drawn from its contents — even just the owner's
// name — would let anyone with the link confirm whose it is and read the parts
// we were asked to keep back, without ever entering the password.
const PRIVATE_PREVIEW = {
  title: "A private portfolio",
  description: "This portfolio is private. Ask its owner for access.",
  image: null,
};

export function previewMetadata(portfolio, origin = "") {
  if (!portfolio || portfolio.visibility !== "public") return PRIVATE_PREVIEW;
  const data = portfolio.data || {};
  const profile = data.profile || {};
  const name = clamp(profile.name, 80);
  const roles = clamp(String(profile.roles ?? "").split(",")[0], 60);
  return {
    title: [name, roles].filter(Boolean).join(" — ") || "A portfolio",
    description: describe(profile, data.about),
    image: absoluteImage(profile.photo, origin),
  };
}

export function buildPreviewHtml({ portfolio, slug, appUrl, canonicalUrl, nonce = "" }) {
  // An uploaded image lives on this server, so its absolute URL is this
  // server's own origin plus the stored path.
  let origin = "";
  try {
    origin = new URL(canonicalUrl).origin;
  } catch {
    origin = "";
  }
  const meta = previewMetadata(portfolio, origin);
  const target = `${appUrl.replace(/\/+$/, "")}/#/p/${encodeURIComponent(slug)}`;
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  const image = meta.image
    ? `\n    <meta property="og:image" content="${escapeHtml(meta.image)}" />\n    <meta name="twitter:image" content="${escapeHtml(meta.image)}" />`
    : "";
  // summary_large_image only looks right when there IS an image; without one
  // Twitter renders a large empty box.
  const card = meta.image ? "summary_large_image" : "summary";

  // The redirect is a <script> first because it leaves no history entry to
  // trap the back button, with a meta refresh behind it for anyone without
  // JavaScript. Crawlers follow neither — they read the tags above and stop.
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <meta property="og:type" content="profile" />
    <meta property="og:site_name" content="Portfolio Builder" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />${image}
    <meta name="twitter:card" content="${card}" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta http-equiv="refresh" content="0; url=${escapeHtml(target)}" />
    <script${nonce ? ` nonce="${escapeHtml(nonce)}"` : ""}>window.location.replace(${JSON.stringify(target)});</script>
  </head>
  <body>
    <p>Taking you to <a href="${escapeHtml(target)}">this portfolio</a>…</p>
  </body>
</html>
`;
}
