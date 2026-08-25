// Kept as the single import point for the rest of the server. The actual
// driver selection lives in sql.js and the schema in schema.js; this file
// exists so that every consumer says `from "../db.js"` and none of them has to
// care which database is underneath.
import { sql, dialect, D, nowIso } from "./sql.js";
import { migrate } from "./schema.js";

await migrate();

export { sql, dialect, D, nowIso };
