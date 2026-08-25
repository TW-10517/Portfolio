import { Router } from "express";
import { db } from "../db.js";
import { buildPreviewHtml } from "../preview.js";

export const previewRouter = Router();

const APP_URL = process.env.FRONTEND_URL || "http://localhost:5173";

function canonicalUrl(req) {
  // Behind a reverse proxy the socket is plain HTTP even when the visitor
  // arrived over TLS, and an og:url that downgrades to http gets flagged as
  // mixed content by some crawlers.
  const proto = (req.headers["x-forwarded-proto"] || req.protocol || "http").split(",")[0].trim();
  return `${proto}://${req.headers.host}${req.originalUrl}`;
}

previewRouter.get("/:slug", (req, res) => {
  const row = db.prepare("SELECT slug, data, visibility FROM portfolios WHERE slug = ?").get(req.params.slug);

  // Deliberately no 404: an unknown slug and a private one must be
  // indistinguishable, and a human following a stale link should still land
  // in the app, which explains what happened far better than a bare status
  // code. Visits here never touch the view counter — a crawler unfurling a
  // link in a group chat is not a reader.
  const portfolio = row
    ? { slug: row.slug, visibility: row.visibility, data: safeParse(row.data) }
    : null;

  res
    .status(200)
    .type("html")
    // Crawlers re-fetch on every unfurl and portfolios change; a short shared
    // cache keeps a link that gets pasted around from hammering the database
    // without pinning a stale name for long.
    .set("Cache-Control", "public, max-age=0, s-maxage=300")
    .send(
      buildPreviewHtml({
        portfolio,
        slug: req.params.slug,
        appUrl: APP_URL,
        canonicalUrl: canonicalUrl(req),
      })
    );
});

function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}
