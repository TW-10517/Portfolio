import { Router } from "express";
import { sql, nowIso } from "../db.js";
import { validatePortfolioData } from "../validatePortfolio.js";
import { requireAuth, hashPassword, verifyPassword } from "../auth.js";

export const portfolioRouter = Router();

const VISIBILITIES = new Set(["public", "private", "password"]);

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

// Get the current user's own portfolio (null if they haven't saved one yet)
portfolioRouter.get("/mine", requireAuth, async (req, res) => {
  const row = await sql.get("SELECT * FROM portfolios WHERE user_id = ?", [req.user.sub]);
  res.json({ portfolio: row ? { ...row, data: JSON.parse(row.data) } : null });
});

// Save/update the current user's portfolio (auto-creates row on first save)
portfolioRouter.put("/mine", requireAuth, async (req, res) => {
  const { data, slug: desiredSlug, visibility, password } = req.body || {};
  if (!data) return res.status(400).json({ error: "Missing portfolio data." });

  // Structural checks before anything is written. The client sanitizes URLs
  // too, but the client is the part an attacker controls.
  const invalid = validatePortfolioData(data);
  if (invalid) return res.status(400).json({ error: invalid });

  const existing = await sql.get("SELECT * FROM portfolios WHERE user_id = ?", [req.user.sub]);
  const baseSlug = slugify(desiredSlug) || `portfolio-${req.user.sub}`;

  let slug = baseSlug;
  let suffix = 1;
  while (true) {
    const clash = await sql.get("SELECT id FROM portfolios WHERE slug = ? AND user_id != ?", [slug, req.user.sub]);
    if (!clash) break;
    slug = `${baseSlug}-${suffix++}`;
  }

  const dataJson = JSON.stringify(data);
  const vis = VISIBILITIES.has(visibility) ? visibility : "public";
  // Never store the visitor-facing unlock password in plaintext, same as
  // account passwords. Only re-hash when the caller actually sent a new
  // password — an empty string here just means "keep the existing one".
  let pw = "";
  if (vis === "password") {
    pw = password ? await hashPassword(password) : existing?.password || "";
  }

  const stamp = nowIso();
  if (existing) {
    await sql.run(
      "UPDATE portfolios SET data = ?, slug = ?, visibility = ?, password = ?, updated_at = ? WHERE user_id = ?",
      [dataJson, slug, vis, pw, stamp, req.user.sub]
    );
  } else {
    await sql.run(
      "INSERT INTO portfolios (user_id, slug, data, visibility, password, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [req.user.sub, slug, dataJson, vis, pw, stamp, stamp]
    );
  }

  const row = await sql.get("SELECT * FROM portfolios WHERE user_id = ?", [req.user.sub]);
  res.json({ portfolio: { ...row, data: JSON.parse(row.data) } });
});

// Removes the user's published portfolio entirely (frees the slug, kills the
// share link). Distinct from setting visibility to "private", which keeps the
// row and the slug reserved.
portfolioRouter.delete("/mine", requireAuth, async (req, res) => {
  await sql.run("DELETE FROM portfolios WHERE user_id = ?", [req.user.sub]);
  res.status(204).end();
});

// Public: fetch a published portfolio by slug (no auth) — this is what the share link hits.
// If password-protected, `data` is withheld entirely until /unlock succeeds, and if private,
// `data` is never returned at all — the client must never receive portfolio contents before
// the visibility/password rules actually allow it.
portfolioRouter.get("/by-slug/:slug", async (req, res) => {
  const row = await sql.get("SELECT * FROM portfolios WHERE slug = ?", [req.params.slug]);
  if (!row) return res.status(404).json({ error: "No portfolio found at this link." });

  // Private portfolios answer exactly like a nonexistent slug, so this
  // endpoint can't be used to discover which slugs are taken/real.
  if (row.visibility === "private") {
    return res.status(404).json({ error: "No portfolio found at this link." });
  }

  if (row.visibility === "password") {
    return res.json({ portfolio: { slug: row.slug, visibility: "password", protected: true, views: row.views } });
  }

  await sql.run("UPDATE portfolios SET views = views + 1 WHERE id = ?", [row.id]);
  res.json({ portfolio: { slug: row.slug, data: JSON.parse(row.data), visibility: "public", views: row.views + 1 } });
});

// Password check for a protected portfolio (keeps the password server-side)
portfolioRouter.post("/by-slug/:slug/unlock", async (req, res) => {
  const row = await sql.get("SELECT * FROM portfolios WHERE slug = ?", [req.params.slug]);
  if (!row) return res.status(404).json({ error: "No portfolio found at this link." });
  if (row.visibility !== "password") return res.status(400).json({ error: "This portfolio isn't password-protected." });

  const { password } = req.body || {};
  const valid = !!password && !!row.password && (await verifyPassword(password, row.password));
  if (!valid) return res.status(401).json({ error: "Incorrect password." });

  await sql.run("UPDATE portfolios SET views = views + 1 WHERE id = ?", [row.id]);
  res.json({ unlocked: true, data: JSON.parse(row.data) });
});
