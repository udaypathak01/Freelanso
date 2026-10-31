import cors from "cors";
import { env } from "./env.js";

export const corsMiddleware = cors({
  origin(origin, callback) {
    if (!origin || env.corsAllowedOrigins.includes(origin))
      return callback(null, true);
    const error = new Error("Origin is not allowed by CORS policy");
    error.status = 403;
    error.code = "CORS_ORIGIN_FORBIDDEN";
    return callback(error);
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Authorization",
    "Content-Type",
    "Idempotency-Key",
    "X-Request-Id",
  ],
  maxAge: 600,
});
