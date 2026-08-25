// The single import point for the rest of the server. Driver selection lives
// in sql.js and the schema in schema.js; this file exists so every consumer
// says `from "../db.js"` and none of them has to care which database is
// underneath.
//
// Imported dynamically so that a database that won't open is reported as a
// configuration problem rather than as a stack trace from inside a connection
// pool — which is what you get at 2am with a typo in DATABASE_URL.
let sql;
let dialect;
let D;
let nowIso;

try {
  ({ sql, dialect, D, nowIso } = await import("./sql.js"));
  const { migrate } = await import("./schema.js");
  await migrate();
} catch (error) {
  console.error(`\nCould not open the database.\n`);
  console.error(`  DATABASE_URL: ${describeUrl(process.env.DATABASE_URL)}`);
  console.error(`  ${error?.message || error}\n`);
  if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT/.test(error?.code || "")) {
    console.error("  Nothing is listening there. Check the host, the port, and that the database is running.");
  } else if (/password|authentication/i.test(error?.message || "")) {
    console.error("  The server rejected those credentials.");
  } else if (/SQLITE_CANTOPEN|ENOENT|EACCES/.test(`${error?.code || ""} ${error?.message || ""}`) || /directory does not exist/i.test(error?.message || "")) {
    console.error("  That path isn't writable, or its parent directory doesn't exist.");
  }
  console.error("\n  Leave DATABASE_URL unset to fall back to SQLite at server/data.sqlite.\n");
  throw error;
}

// Never print the password, even into a log the operator asked for.
function describeUrl(url) {
  if (!url) return "(unset — SQLite at server/data.sqlite)";
  try {
    const parsed = new URL(url);
    if (parsed.password) parsed.password = "***";
    return parsed.href;
  } catch {
    return url;
  }
}

export { sql, dialect, D, nowIso };
