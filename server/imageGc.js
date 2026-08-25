import { sql } from "./db.js";

// Uploaded image bytes are shared: two accounts using the same picture point
// at one row, because the key is a hash of the content. So a blob can only be
// removed once nothing claims it — which is what image_owners records.
//
// Without this, "delete my account" was a lie. It returned 204, removed the
// user and their portfolio, and left their photographs on the server, still
// downloadable by anyone holding the URL. Before images moved out of the
// portfolio JSON the same delete took the pictures with it, so this was a
// regression in what deletion means, not just untidiness.
export async function deleteUnreferencedBlobs() {
  const { changes } = await sql.run(
    "DELETE FROM image_blobs WHERE hash NOT IN (SELECT hash FROM image_owners)"
  );
  return changes;
}

// Everything the account claims, gone — then whatever that orphaned.
export async function forgetUsersImages(userId) {
  await sql.run("DELETE FROM image_owners WHERE user_id = ?", [userId]);
  return deleteUnreferencedBlobs();
}

const HASH = /\/api\/images\/([0-9a-f]{64})/g;

export function hashesIn(value) {
  const found = new Set();
  for (const match of JSON.stringify(value ?? null).matchAll(HASH)) found.add(match[1]);
  return found;
}

// Replacing a photo leaves the old one owned but referenced by nothing, so
// ownership is re-synced from the saved document on every save.
//
// The grace period is the important part. An upload lands a moment before the
// save that mentions it, and a save from another tab — holding a copy of the
// portfolio from before the upload — would otherwise reap a picture the user
// had just chosen. An hour is far longer than that gap and costs only some
// delayed cleanup.
export const GRACE_MS = 60 * 60 * 1000;

// Timestamps are stored as "YYYY-MM-DD HH:MM:SS" in UTC. Date.parse happens to
// accept that in V8, but a space separator is implementation-defined, and the
// failure mode matters here: NaN would make every age comparison false and the
// collector would silently stop running. Normalising to real ISO makes it
// defined, and an unparseable value is treated as "too new to touch" so a bad
// row can never cost someone a photograph.
export function ageOf(stamp, now) {
  const parsed = Date.parse(`${String(stamp).replace(" ", "T")}Z`);
  return Number.isNaN(parsed) ? 0 : now - parsed;
}

export async function syncOwnership(userId, portfolioData, { now = Date.now() } = {}) {
  const referenced = hashesIn(portfolioData);
  const owned = await sql.all("SELECT hash, created_at FROM image_owners WHERE user_id = ?", [userId]);

  const stale = owned.filter((row) => !referenced.has(row.hash) && ageOf(row.created_at, now) > GRACE_MS);
  if (!stale.length) return 0;

  const placeholders = stale.map(() => "?").join(",");
  await sql.run(`DELETE FROM image_owners WHERE user_id = ? AND hash IN (${placeholders})`, [
    userId,
    ...stale.map((r) => r.hash),
  ]);
  return deleteUnreferencedBlobs();
}
