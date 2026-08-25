import { Router } from "express";
import crypto from "crypto";
import express from "express";
import { sql, D, nowIso } from "../db.js";
import { requireAuth } from "../auth.js";
import { uploadLimiter } from "../rateLimit.js";

export const imageRouter = Router();

// Uploads arrive already downscaled by the browser (1600px, WebP), so this cap
// is a backstop against something pathological rather than a working limit —
// a normal photo lands around 500KB.
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

// One person's whole library. Generous enough that no real portfolio hits it,
// small enough that a single account can't fill the disk.
export const MAX_BYTES_PER_USER = 200 * 1024 * 1024;

// Only formats a browser will actually render, and only ones whose bytes we
// can identify from a magic number below. SVG is deliberately absent: it is a
// document that can carry script, and serving it from our own origin would
// make every upload a stored-XSS vector.
const ALLOWED = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

// A Content-Type header is whatever the client says it is. These check what
// the bytes actually are, so a mislabelled — or deliberately disguised —
// upload can't be stored and later served back under a type of the
// attacker's choosing.
function sniff(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.toString("ascii", 0, 3) === "GIF") return "image/gif";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

async function usedBytes(userId) {
  const row = await sql.get(
    `SELECT COALESCE(SUM(b.size), 0) AS total
       FROM image_owners o JOIN image_blobs b ON b.hash = o.hash
      WHERE o.user_id = ?`,
    [userId]
  );
  // Postgres returns SUM as numeric, which the driver hands back as a string.
  return Number(row.total);
}

imageRouter.post(
  "/",
  requireAuth,
  // The per-account byte quota bounds how much can be stored, but nothing
  // bounded how fast: an account could hammer this endpoint with small files
  // and make the server hash and write all of them.
  uploadLimiter,
  express.raw({ type: () => true, limit: MAX_IMAGE_BYTES }),
  async (req, res) => {
    const bytes = req.body;
    if (!Buffer.isBuffer(bytes) || bytes.length === 0) {
      return res.status(400).json({ error: "Send the image as the raw request body." });
    }

    const mime = sniff(bytes);
    if (!mime || !ALLOWED.has(mime)) {
      return res.status(400).json({ error: "That file isn't a PNG, JPEG, WebP or GIF image." });
    }

    const hash = crypto.createHash("sha256").update(bytes).digest("hex");
    const existing = await sql.get("SELECT size FROM image_blobs WHERE hash = ?", [hash]);

    // Re-uploading something already stored must not count against the quota
    // twice, and must not fail once the quota is full — otherwise re-saving an
    // unchanged portfolio would start erroring.
    if (!existing && (await usedBytes(req.user.sub)) + bytes.length > MAX_BYTES_PER_USER) {
      return res.status(413).json({ error: "You've used all your image storage. Remove some images first." });
    }

    const stamp = nowIso();
    await sql.tx(async () => {
      // Written unconditionally rather than only when `existing` was false.
      // That check happened outside this transaction, and the collector can
      // remove an unclaimed blob in between — leaving this insert to add an
      // owner row pointing at a row that no longer exists, which the foreign
      // key rejects and the uploader sees as a 500. Writing the blob first,
      // ignoring a conflict, means it is always there to be claimed.
      await sql.run(
        D.insertOrIgnore("image_blobs", "hash, mime, bytes, size, created_at", "?, ?, ?, ?, ?"),
        [hash, mime, bytes, bytes.length, stamp]
      );
      await sql.run(D.insertOrIgnore("image_owners", "user_id, hash, created_at", "?, ?, ?"), [
        req.user.sub,
        hash,
        stamp,
      ]);
    });

    // Relative, not absolute. A portfolio saved against localhost and opened
    // in production has to keep working, and an absolute URL would bake the
    // development host into the document forever.
    res.status(201).json({ url: `/api/images/${hash}.${ALLOWED.get(mime)}`, hash, size: bytes.length });
  }
);

imageRouter.get("/:file", async (req, res) => {
  const hash = String(req.params.file).split(".")[0];
  if (!/^[0-9a-f]{64}$/.test(hash)) return res.status(404).json({ error: "Not found" });

  const row = await sql.get("SELECT mime, bytes, size FROM image_blobs WHERE hash = ?", [hash]);
  if (!row) return res.status(404).json({ error: "Not found" });

  res
    .status(200)
    .set({
      "Content-Type": row.mime,
      "Content-Length": String(row.size),
      // The URL is the hash of the content, so the content at this URL can
      // never change. That is exactly what immutable is for.
      "Cache-Control": "public, max-age=31536000, immutable",
      ETag: `"${hash}"`,
      // Stops a browser from second-guessing the type we just verified.
      "X-Content-Type-Options": "nosniff",
    })
    .send(row.bytes);
});

imageRouter.get("/", requireAuth, async (req, res) => {
  res.json({ used: await usedBytes(req.user.sub), limit: MAX_BYTES_PER_USER });
});
