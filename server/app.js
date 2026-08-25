import "dotenv/config";
import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth.js";
import { portfolioRouter } from "./routes/portfolio.js";
import { previewRouter } from "./routes/preview.js";
import { imageRouter } from "./routes/images.js";

// Split from index.js so tests (and any future embedding, e.g. serverless)
// can import the app without binding a port.
export const app = express();

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

app.get("/api/health", (req, res) => res.json({ ok: true }));

// Handlers talk to the database with await now, and Express 5 forwards a
// rejected handler here. Without this the default handler answers an API call
// with an HTML error page, which the client can't parse — so a database blip
// surfaced as "Something went wrong" with no status to act on.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("[api]", err);
  if (res.headersSent) return;
  // A body larger than the parser's limit is the client's fault, not ours.
  const status = err?.status === 413 || err?.type === "entity.too.large" ? 413 : 500;
  res.status(status).json({ error: status === 413 ? "That upload is too large." : "Something went wrong." });
});
