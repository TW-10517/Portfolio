// The save endpoint used to accept any JSON at all as portfolio `data` — no
// shape, no depth limit, no per-string limit, and no check on the URLs inside
// it. That put the whole burden of safety on the client, which is the one
// part an attacker controls. These checks are deliberately structural rather
// than a full schema: the portfolio shape evolves with the editor, so pinning
// every field here would break saving every time a tab gains an option.

// Express already caps the request body at 15MB; this is the portfolio-only
// budget inside that, leaving room for the rest of the envelope.
const MAX_JSON_BYTES = 12 * 1024 * 1024;

// Images and the resume PDF are stored inline as base64, so single strings
// are legitimately large — 8MB covers a 5MB PDF after base64 expansion.
const MAX_STRING_LENGTH = 8 * 1024 * 1024;

// Deep nesting is never produced by the editor; it only shows up in attempts
// to blow the stack of whatever parses the document later.
const MAX_DEPTH = 12;

// Bounds the total node count so a payload can't be small on the wire but
// enormous once parsed.
const MAX_NODES = 50000;

// Control characters are ignored by browsers when resolving a URL, so
// "java\tscript:" navigates as "javascript:". Strip before testing.
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/g;
const DANGEROUS_SCHEME = /^(?:javascript|vbscript|livescript|mocha):/i;
// The image branch required a semicolon after the media type, so a data URL
// with no parameters — "data:image/png,…", which is perfectly valid and what
// you get from encodeURIComponent rather than base64 — was classed as
// dangerous and the whole save rejected. The PDF branch already allowed both
// separators; this one didn't.
const DANGEROUS_DATA = /^data:(?!image\/(?:png|jpeg|jpg|gif|webp|svg\+xml)[;,]|application\/pdf[;,])/i;

function isDangerousUrlString(value) {
  const cleaned = value.replace(CONTROL_CHARS, "").trim();
  return DANGEROUS_SCHEME.test(cleaned) || DANGEROUS_DATA.test(cleaned);
}

/**
 * Structural validation for a portfolio document.
 * Returns `null` when the data is acceptable, or an error message string.
 */
export function validatePortfolioData(data) {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return "Portfolio data must be an object.";
  }

  let json;
  try {
    json = JSON.stringify(data);
  } catch {
    // Circular structures can't round-trip through the database.
    return "Portfolio data could not be serialized.";
  }
  if (Buffer.byteLength(json, "utf8") > MAX_JSON_BYTES) {
    return "Portfolio is too large. Try removing or shrinking some images.";
  }

  let nodes = 0;
  const walk = (value, depth) => {
    if (++nodes > MAX_NODES) return "Portfolio has too many fields.";
    if (depth > MAX_DEPTH) return "Portfolio data is nested too deeply.";

    if (typeof value === "string") {
      if (value.length > MAX_STRING_LENGTH) return "A field in your portfolio is too long.";
      if (isDangerousUrlString(value)) return "Portfolio contains a link with an unsupported scheme.";
      return null;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        const err = walk(item, depth + 1);
        if (err) return err;
      }
      return null;
    }
    if (value && typeof value === "object") {
      for (const key of Object.keys(value)) {
        // A "__proto__" key survives JSON.parse as an own property and can
        // poison whatever merges this document later.
        if (key === "__proto__" || key === "constructor" || key === "prototype") {
          return "Portfolio contains a reserved field name.";
        }
        const err = walk(value[key], depth + 1);
        if (err) return err;
      }
      return null;
    }
    return null;
  };

  return walk(data, 0);
}

export const LIMITS = { MAX_JSON_BYTES, MAX_STRING_LENGTH, MAX_DEPTH, MAX_NODES };
