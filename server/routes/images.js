import { Router } from "express";
import crypto from "crypto";
import express from "express";
import { db } from "../db.js";
import { requireAuth } from "../auth.js";

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

function usedBytes(userId) {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(b.size), 0) AS total
         FROM image_owners o JOIN image_blobs b ON b.hash = o.hash
        WHERE o.user_id = ?`
    )
    .get(userId);
  return row.total;
}

imageRouter.post(
  "/",
  requireAuth,
  express.raw({ type: () => true, limit: MAX_IMAGE_BYTES }),
  (req, res) => {
    const bytes = req.body;
    if (!Buffer.isBuffer(bytes) || bytes.length === 0) {
      return res.status(400).json({ error: "Send the image as the raw request body." });
    }

    const mime = sniff(bytes);
    if (!mime || !ALLOWED.has(mime)) {
      return res.status(400).json({ error: "That file isn't a PNG, JPEG, WebP or GIF image." });
    }

    const hash = crypto.createHash("sha256").update(bytes).digest("hex");
    const existing = db.prepare("SELECT size FROM image_blobs WHERE hash = ?").get(hash);

    // Re-uploading something already stored must not count against the quota
    // twice, and must not fail once the quota is full — otherwise re-saving an
    // unchanged portfolio would start erroring.
    if (!existing && usedBytes(req.user.sub) + bytes.length > MAX_BYTES_PER_USER) {
      return res.status(413).json({ error: "You've used all your image storage. Remove some images first." });
    }

    db.transaction(() => {
      if (!existing) {
        db.prepare("INSERT INTO image_blobs (hash, mime, bytes, size) VALUES (?, ?, ?, ?)").run(
          hash,
          mime,
          bytes,
          bytes.length
        );
      }
      db.prepare("INSERT OR IGNORE INTO image_owners (user_id, hash) VALUES (?, ?)").run(req.user.sub, hash);
    })();

    // Relative, not absolute. A portfolio saved against localhost and opened
    // in production has to keep working, and an absolute URL would bake the
    // development host into the document forever.
    res.status(201).json({ url: `/api/images/${hash}.${ALLOWED.get(mime)}`, hash, size: bytes.length });
  }
);

imageRouter.get("/:file", (req, res) => {
  const hash = String(req.params.file).split(".")[0];
  if (!/^[0-9a-f]{64}$/.test(hash)) return res.status(404).json({ error: "Not found" });

  const row = db.prepare("SELECT mime, bytes, size FROM image_blobs WHERE hash = ?").get(hash);
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

imageRouter.get("/", requireAuth, (req, res) => {
  res.json({ used: usedBytes(req.user.sub), limit: MAX_BYTES_PER_USER });
});
