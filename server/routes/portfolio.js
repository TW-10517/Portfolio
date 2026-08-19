import { Router } from "express";
import { db } from "../db.js";
import { requireAuth } from "../auth.js";

export const portfolioRouter = Router();

function slugify(str) {
  return (str || "")
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// Get the current user's own portfolio (creates an empty draft row on first access)
portfolioRouter.get("/mine", requireAuth, (req, res) => {
  const row = db.prepare("SELECT * FROM portfolios WHERE user_id = ?").get(req.user.sub);
  res.json({ portfolio: row || null });
});

// Save/update the current user's portfolio (auto-creates row on first save)
portfolioRouter.put("/mine", requireAuth, (req, res) => {
  const { data, slug: desiredSlug, visibility, password } = req.body || {};
  if (!data) return res.status(400).json({ error: "Missing portfolio data." });

  const existing = db.prepare("SELECT * FROM portfolios WHERE user_id = ?").get(req.user.sub);
  const baseSlug = slugify(desiredSlug) || `portfolio-${req.user.sub}`;

  let slug = baseSlug;
  let suffix = 1;
  while (true) {
    const clash = db.prepare("SELECT id FROM portfolios WHERE slug = ? AND user_id != ?").get(slug, req.user.sub);
    if (!clash) break;
    slug = `${baseSlug}-${suffix++}`;
  }

  const dataJson = JSON.stringify(data);
  const vis = visibility === "password" ? "password" : "public";
  const pw = vis === "password" ? password || "" : "";

  if (existing) {
    db.prepare(
      "UPDATE portfolios SET data = ?, slug = ?, visibility = ?, password = ?, updated_at = datetime('now') WHERE user_id = ?"
    ).run(dataJson, slug, vis, pw, req.user.sub);
  } else {
    db.prepare(
      "INSERT INTO portfolios (user_id, slug, data, visibility, password) VALUES (?, ?, ?, ?, ?)"
    ).run(req.user.sub, slug, dataJson, vis, pw);
  }

  const row = db.prepare("SELECT * FROM portfolios WHERE user_id = ?").get(req.user.sub);
  res.json({ portfolio: row });
});

// Public: fetch a published portfolio by slug (no auth) — this is what the share link hits.
// If password-protected, `data` is withheld entirely until /unlock succeeds — the client
// must never receive portfolio contents before a correct password is verified server-side.
portfolioRouter.get("/by-slug/:slug", (req, res) => {
  const row = db.prepare("SELECT * FROM portfolios WHERE slug = ?").get(req.params.slug);
  if (!row) return res.status(404).json({ error: "No portfolio found at this link." });

  db.prepare("UPDATE portfolios SET views = views + 1 WHERE id = ?").run(row.id);

  if (row.visibility === "password") {
    return res.json({ portfolio: { slug: row.slug, visibility: "password", protected: true, views: row.views + 1 } });
  }

  res.json({
    portfolio: { slug: row.slug, data: JSON.parse(row.data), visibility: row.visibility, views: row.views + 1 },
  });
});

// Password check for a protected portfolio (keeps the password server-side)
portfolioRouter.post("/by-slug/:slug/unlock", (req, res) => {
  const row = db.prepare("SELECT * FROM portfolios WHERE slug = ?").get(req.params.slug);
  if (!row) return res.status(404).json({ error: "No portfolio found at this link." });
  if (row.visibility !== "password") return res.json({ unlocked: true, data: JSON.parse(row.data) });

  const { password } = req.body || {};
  if (password !== row.password) return res.status(401).json({ error: "Incorrect password." });
  res.json({ unlocked: true, data: JSON.parse(row.data) });
});
