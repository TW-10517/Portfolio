// SQLite is a single file, which makes backups easy but also easy to forget.
// This uses better-sqlite3's online backup API rather than copying the file:
// a plain `cp` of a WAL-mode database while the server is writing can produce
// a torn copy, whereas this takes a consistent snapshot of a live database.
//
//   npm run db:backup                 # -> server/backups/data-<timestamp>.sqlite
//   npm run db:backup -- /some/path.sqlite
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { sql, dialect } from "../db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Keep this many of the most recent automatic backups; older ones are pruned
// so an unattended cron job can't fill the disk.
const KEEP = 10;

// Only SQLite has a file to snapshot. On Postgres this is pg_dump's job, and
// silently doing nothing would be worse than saying so.
if (dialect !== "sqlite") {
  console.error("This backs up a SQLite file. You're on Postgres — use pg_dump, or your host's snapshots.");
  process.exit(1);
}

const explicit = process.argv[2];
const dir = path.join(__dirname, "..", "backups");
if (!explicit) fs.mkdirSync(dir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const dest = explicit || path.join(dir, `data-${stamp}.sqlite`);

try {
  await sql.native.backup(dest);
  const { size } = fs.statSync(dest);
  console.log(`Backed up to ${dest} (${(size / 1024).toFixed(0)} KB)`);
} catch (err) {
  console.error(`Backup failed: ${err.message}`);
  process.exit(1);
}

if (!explicit) {
  const old = fs
    .readdirSync(dir)
    .filter((f) => /^data-.*\.sqlite$/.test(f))
    .sort()
    .slice(0, -KEEP);
  for (const f of old) fs.rmSync(path.join(dir, f));
  if (old.length) console.log(`Pruned ${old.length} older backup(s), keeping the newest ${KEEP}.`);
}
