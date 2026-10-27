import { randomUUID } from "node:crypto";
import { HttpError } from "./validate.js";

export function requestId(req, res, next) {
  req.id = req.get("x-request-id") ?? randomUUID();
  res.set("x-request-id", req.id);
  next();
}

export function logger({ silent = false } = {}) {
  return (req, res, next) => {
    const start = process.hrtime.bigint();
    res.on("finish", () => {
      if (silent) return;
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(1)}ms id=${req.id}`);
    });
    next();
  };
}

/** Fixed-window rate limiter kept in memory, keyed by client IP. */
export function rateLimit({ windowMs = 60_000, max = 100 } = {}) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const entry = hits.get(req.ip);
    const bucket = entry && entry.reset > now ? entry : { count: 0, reset: now + windowMs };
    bucket.count += 1;
    hits.set(req.ip, bucket);
    res.set("RateLimit-Limit", String(max));
    res.set("RateLimit-Remaining", String(Math.max(max - bucket.count, 0)));
    res.set("RateLimit-Reset", String(Math.ceil((bucket.reset - now) / 1000)));
    if (bucket.count > max) return next(new HttpError(429, "Too many requests, slow down"));
    next();
  };
}

/** Writes require `Authorization: Bearer <API_KEY>` when an API key is configured. */
export function requireKey(apiKey) {
  return (req, res, next) => {
    if (!apiKey || req.method === "GET") return next();
    if (req.get("authorization") === `Bearer ${apiKey}`) return next();
    next(new HttpError(401, "Missing or invalid API key"));
  };
}

export function notFound(req, res, next) {
  next(new HttpError(404, `No route for ${req.method} ${req.path}`));
}

// Express recognises error handlers by their four arguments.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const status = err.status ?? (err.type === "entity.parse.failed" ? 400 : 500);
  if (status >= 500) console.error(err);
  res.status(status).json({
    error: { status, message: status >= 500 ? "Internal server error" : err.message, details: err.details, requestId: req.id },
  });
}
