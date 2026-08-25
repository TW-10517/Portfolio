import { app } from "./app.js";
import { sql } from "./db.js";

const PORT = process.env.PORT || 4000;

const server = app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`);
});

// Every managed host deploys by sending SIGTERM and then killing whatever is
// left a few seconds later. Without this, in-flight requests are cut off
// mid-response on every deploy, and SQLite is closed by process death rather
// than by checkpointing its write-ahead log.
let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n[server] ${signal} — finishing in-flight requests…`);

  // A hard deadline: a hung connection must not stop the process exiting, or
  // the host kills it anyway and we gained nothing.
  const deadline = setTimeout(() => {
    console.warn("[server] shutdown timed out; exiting anyway");
    process.exit(1);
  }, 10_000);
  deadline.unref();

  server.close(async () => {
    try {
      await sql.close();
    } catch (e) {
      console.error("[server] closing the database failed:", e.message);
    }
    clearTimeout(deadline);
    console.log("[server] closed cleanly");
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
