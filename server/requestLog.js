import crypto from "crypto";
import { log } from "./logger.js";

// Gives every request an id and logs how it ended.
//
// The id is the point. When someone says "it failed when I tried to publish",
// there is otherwise nothing connecting that sentence to a line in the logs.
// It goes out on the response too, so the number in front of the user is the
// number to search for.
const HEALTH = /^\/api\/health$/;

export function requestLog(req, res, next) {
  // Honour an id the proxy already assigned, so one request is one id across
  // every hop rather than a new one per service.
  const existing = req.headers["x-request-id"];
  const id = typeof existing === "string" && /^[\w-]{1,64}$/.test(existing) ? existing : crypto.randomUUID();
  req.id = id;
  res.setHeader("X-Request-Id", id);

  const started = process.hrtime.bigint();

  res.on("finish", () => {
    // Uptime checks hit this every minute forever; logging them buries
    // everything else.
    if (HEALTH.test(req.path) && res.statusCode < 400) return;

    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    const fields = {
      id,
      method: req.method,
      // req.route?.path would be the pattern rather than the value, but it is
      // only populated for matched routes; the raw path is what a 404 needs.
      path: req.originalUrl.split("?")[0],
      status: res.statusCode,
      ms: Math.round(ms),
      ip: req.ip,
    };
    if (res.statusCode >= 500) log.error("request failed", fields);
    else if (res.statusCode >= 400) log.warn("request rejected", fields);
    else log.info("request", fields);
  });

  next();
}
