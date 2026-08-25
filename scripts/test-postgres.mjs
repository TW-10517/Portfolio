// Runs the server suites against PostgreSQL instead of SQLite.
//
// A plain `TEST_DATABASE_URL=pglite vitest ...` in package.json only works on
// a POSIX shell; npm runs scripts through cmd.exe on Windows, where that is a
// syntax error. Spawning with an explicit env keeps one command working
// everywhere.
import { spawnSync } from "child_process";

const result = spawnSync("npx", ["vitest", "run", "server", ...process.argv.slice(2)], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, TEST_DATABASE_URL: "pglite" },
});

process.exit(result.status ?? 1);
