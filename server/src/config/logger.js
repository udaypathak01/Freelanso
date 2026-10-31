import pino from "pino";
import { env } from "./env.js";

export const logger = pino({
  level: env.logLevel,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.body.password",
      "req.body.email",
      "req.body.phone",
      "req.body.token",
      "req.body.idToken",
      "req.body.accessToken",
      "req.body.refreshToken",
      "password",
      "token",
      "idToken",
      "accessToken",
      "refreshToken",
      "email",
      "phone",
    ],
    censor: "[REDACTED]",
  },
});
