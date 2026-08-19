// The theme's "Custom CSS" is authored by one user but — now that portfolios
// are served publicly at /p/:slug — rendered in *other people's* browsers.
// Raw CSS in that position is not harmless: `url()` can beacon a visitor's
// presence to a third-party server, `@import` can pull in an entire remote
// stylesheet, `position:fixed` overlays can cover the page for clickjacking,
// and `expression()`/`javascript:` execute script in older engines.
//
// This strips those specific capabilities rather than trying to be a full CSS
// parser: everything removed here is a vector that only matters because the
// output is shown to third parties, and none of it is needed for the styling
// tweaks this field exists for (colors, spacing, fonts, borders, etc.).
const BLOCKED_PATTERNS = [
  /@import\b/gi,
  /url\s*\(/gi,
  /expression\s*\(/gi,
  /javascript\s*:/gi,
  /behavior\s*:/gi,
  /-moz-binding/gi,
  /<\/?\s*style/gi, // can't break out of the <style> element
  /<\s*script/gi,
];

export function sanitizeCustomCss(css) {
  if (!css) return "";
  let out = String(css);
  for (const pattern of BLOCKED_PATTERNS) out = out.replace(pattern, "/*blocked*/");
  // Neutralize viewport-covering overlays (clickjacking) while still allowing
  // ordinary positioned layout inside the page.
  out = out.replace(/position\s*:\s*fixed/gi, "position:static");
  return out;
}
