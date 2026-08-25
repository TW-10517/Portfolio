import "dotenv/config";
import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth.js";
import { portfolioRouter } from "./routes/portfolio.js";
import { previewRouter } from "./routes/preview.js";
import { imageRouter } from "./routes/images.js";
import { trustProxySetting, warnOnUntrustedProxy } from "./trustProxy.js";
import { securityHeaders } from "./securityHeaders.js";
import { requestLog } from "./requestLog.js";
import { log, describeError } from "./logger.js";
import { sql, dialect } from "./db.js";

// Split from index.js so tests (and any future embedding, e.g. serverless)
// can import the app without binding a port.
export const app = express();

// Must be set before anything reads req.ip — the rate limiters do.
app.set("trust proxy", trustProxySetting());
app.use(warnOnUntrustedProxy(app));
app.use(securityHeaders);
app.use(requestLog);

const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173").split(",").map((s) => s.trim());
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: "15mb" })); // portfolios can include base64 images

app.use("/api/auth", authRouter);
app.use("/api/portfolios", portfolioRouter);
// The upload route brings its own raw-body parser: an image is bytes, not
// JSON, and the global express.json above simply passes it through.
app.use("/api/images", imageRouter);

// Not under /api: this is the URL a person pastes into Slack, so it has to
// look like a page, not an endpoint.
app.use("/p", previewRouter);

// Watched by an uptime monitor, so it has to fail when the app is actually
// broken. Answering {ok:true} from a process whose database has gone away is
// worse than having no health check: the monitor stays green through an
// outage, which is the one moment it exists for.
const STARTED_AT = Date.now();

app.get("/api/health", async (req, res) => {
  const body = {
    ok: true,
    uptimeSeconds: Math.round((Date.now() - STARTED_AT) / 1000),
    database: dialect,
  };
  try {
    // Cheap on purpose: this runs every minute forever, so it proves the
    // connection is alive without doing any real work.
    await sql.get("SELECT 1 AS ok");
  } catch (error) {
    log.error("health check failed", { id: req.id, ...describeError(error) });
    // 503, not 500: the service is unavailable rather than confused, and it
    // is the status every monitor and load balancer already understands.
    return res.status(503).json({ ...body, ok: false, database: "unreachable" });
  }
  res.json(body);
});

// Handlers talk to the database with await now, and Express 5 forwards a
// rejected handler here. Without this the default handler answers an API call
// with an HTML error page, which the client can't parse — so a database blip
// surfaced as "Something went wrong" with no status to act on.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // A body larger than the parser's limit is the client's fault, not ours.
  const status = err?.status === 413 || err?.type === "entity.too.large" ? 413 : 500;
  if (status >= 500) {
    log.error("unhandled error", { id: req.id, path: req.originalUrl.split("?")[0], ...describeError(err) });
  }
  if (res.headersSent) return;
  res.status(status).json({
    error: status === 413 ? "That upload is too large." : "Something went wrong.",
    // Handing the id back means a user can quote the exact line to search for
    // instead of describing what they were doing.
    requestId: req.id,
  });
});
