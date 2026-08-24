// Browser-driven QA runs register a throwaway account every time, and the dev
// database had accumulated 53 of them. This clears accounts whose email
// matches a test pattern (and the portfolios attached to them) so the dev
// data stays legible, without touching anything that looks like a real user.
//
//   npm run db:clear-test-users              # removes *@example.com
//   npm run db:clear-test-users -- '%@qa.local'
import "dotenv/config";
import { db } from "../db.js";

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to run against a production database.");
  process.exit(1);
}

const pattern = process.argv[2] || "%@example.com";

const doomed = db.prepare("SELECT id, email FROM users WHERE email LIKE ?").all(pattern);
if (!doomed.length) {
  console.log(`No users match ${pattern}. Nothing to do.`);
  process.exit(0);
}

const ids = doomed.map((u) => u.id);
const placeholders = ids.map(() => "?").join(",");
const portfolios = db.prepare(`SELECT COUNT(*) c FROM portfolios WHERE user_id IN (${placeholders})`).get(...ids).c;

// SQLite only honours ON DELETE CASCADE when foreign keys are enabled per
// connection, so the child rows go explicitly rather than being orphaned.
db.transaction(() => {
  db.prepare(`DELETE FROM portfolios WHERE user_id IN (${placeholders})`).run(...ids);
  db.prepare(`DELETE FROM users WHERE id IN (${placeholders})`).run(...ids);
})();

console.log(`Removed ${doomed.length} test user(s) matching ${pattern} and ${portfolios} portfolio(s).`);
