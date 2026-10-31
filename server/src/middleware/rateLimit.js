import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";

export function createRateLimiter({
  windowMs,
  limit,
  keyGenerator,
  skip,
} = {}) {
  return rateLimit({
    windowMs,
    limit,
    ...(keyGenerator ? { keyGenerator } : {}),
    ...(skip ? { skip } : {}),
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler(req, res) {
      req.log?.warn(
        {
          requestId: req.id,
          uid: req.user?.uid,
          rateLimitExceeded: true,
        },
        "Rate limit exceeded",
      );
      res.status(429).json({
        success: false,
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many requests",
          requestId: req.id,
        },
      });
    },
  });
}

export const rateLimiters = {
  default: createRateLimiter({
    windowMs: env.rateLimitWindowMs,
    limit: env.rateLimitMax,
    skip: (req) => req.path === "/healthz" || req.path === "/readyz",
  }),
  write: createRateLimiter({
    windowMs: env.rateLimitWindowMs,
    limit: Math.max(1, Math.floor(env.rateLimitMax / 2)),
  }),
  ai: createRateLimiter({
    windowMs: env.rateLimitWindowMs,
    limit: Math.min(20, Math.max(1, Math.floor(env.rateLimitMax / 10))),
  }),
  supportIp: createRateLimiter({
    windowMs: 60 * 60 * 1000,
    limit: 5,
  }),
  supportUser: createRateLimiter({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    keyGenerator: (req) => req.user.uid,
    skip: (req) => !req.user?.uid,
  }),
  social: createRateLimiter({
    windowMs: env.rateLimitWindowMs,
    limit: Math.max(1, Math.floor(env.rateLimitMax / 10)),
  }),
  message: createRateLimiter({
    windowMs: 10_000,
    limit: 20,
    keyGenerator: (req) => req.user.uid,
  }),
};
