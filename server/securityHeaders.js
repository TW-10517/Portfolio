// Response headers that cost nothing and close off whole classes of attack.
//
// Written out rather than pulled from a package: there are five of them, each
// needs a reason, and the defaults a library picks are not always the ones
// this app wants — the preview route in particular serves HTML that a strict
// default would break.
export function securityHeaders(req, res, next) {
  // Stop a browser second-guessing a Content-Type we set deliberately. The
  // image route already sets this per-response; this covers everything else,
  // including the JSON error bodies an attacker would love to have sniffed as
  // HTML.
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Nothing here is meant to be framed. A shared portfolio is a page someone
  // opens, not a widget, and framing it is only useful for clickjacking.
  res.setHeader("X-Frame-Options", "DENY");

  // Referrers leak the slug of whatever portfolio someone came from,
  // including a private one. Origin-only keeps analytics working for whoever
  // wants it without carrying the path.
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // No feature here needs a camera, a microphone, or a location.
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");

  // Only over TLS, and only when a proxy has told us the visitor arrived that
  // way. Sending HSTS over plain HTTP is ignored, and sending it from a dev
  // server would pin localhost to HTTPS in the developer's browser — which is
  // a genuinely annoying thing to undo.
  const proto = req.headers["x-forwarded-proto"] || req.protocol;
  if (proto === "https") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  next();
}
