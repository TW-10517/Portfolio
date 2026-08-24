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
import { db } from "../db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Keep this many of the most recent automatic backups; older ones are pruned
// so an unattended cron job can't fill the disk.
const KEEP = 10;

const explicit = process.argv[2];
const dir = path.join(__dirname, "..", "backups");
if (!explicit) fs.mkdirSync(dir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const dest = explicit || path.join(dir, `data-${stamp}.sqlite`);

try {
  await db.backup(dest);
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
