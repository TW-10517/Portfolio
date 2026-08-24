import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Start every run from an empty database. Accounts accumulate otherwise, and
// — since rate-limit counters are persisted now — a stale counter from an
// earlier run trips the registration limiter and fails every spec for reasons
// that have nothing to do with the code under test.
export default function globalSetup() {
  const base = path.join(__dirname, "..", "server", "e2e.sqlite");

  // Preferred: delete the file outright, so schema changes can't leave a
  // stale shape behind.
  try {
    for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(base + suffix, { force: true });
    return;
  } catch (err) {
    // Windows keeps the file locked for a while after a previous run's server
    // exits, and CI runners can hold a handle too. Emptying the tables gets
    // the same clean slate without needing the file to be removable.
    if (err.code !== "EPERM" && err.code !== "EBUSY") throw err;
  }

  try {
    const db = new Database(base);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all();
    db.transaction(() => {
      for (const { name } of tables) db.prepare(`DELETE FROM "${name}"`).run();
    })();
    db.close();
  } catch (err) {
    // A missing or unreadable file is fine — the server recreates it.
    if (err.code !== "SQLITE_CANTOPEN") throw err;
  }
}
