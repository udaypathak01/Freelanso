import { randomUUID } from "node:crypto";
import compression from "compression";
import express from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { corsMiddleware } from "./config/cors.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { jsonOnly } from "./middleware/jsonOnly.js";
import { notFound } from "./middleware/notFound.js";
import { rateLimiters } from "./middleware/rateLimit.js";
import { requestId } from "./middleware/requestId.js";
import healthRoutes from "./modules/health/health.routes.js";
import meRoutes from "./modules/me/me.routes.js";
import usersRoutes from "./modules/users/users.routes.js";
import uploadsRoutes from "./modules/uploads/uploads.routes.js";
import projectsRoutes from "./modules/projects/projects.routes.js";
import servicesRoutes from "./modules/services/services.routes.js";
import metaRoutes from "./modules/meta/meta.routes.js";
import dashboardRoutes from "./modules/dashboard/dashboard.routes.js";
import jobsRoutes from "./modules/jobs/jobs.routes.js";
import applicationsRoutes from "./modules/applications/applications.routes.js";
import battlesRoutes from "./modules/battles/battles.routes.js";
import searchRoutes from "./modules/search/search.routes.js";
import matchesRoutes from "./modules/matches/matches.routes.js";
import supportRoutes from "./modules/support/support.routes.js";
import conversationsRoutes from "./modules/conversations/conversations.routes.js";
import notificationsRoutes from "./modules/notifications/notifications.routes.js";
import walletRoutes from "./modules/withdrawals/withdrawals.routes.js";

export const app = express();

app.disable("x-powered-by");
app.set("trust proxy", env.trustProxy);

app.use(requestId);
app.use(
  pinoHttp({
    logger,
    genReqId: (req) => req.id || randomUUID(),
    customProps: (req) => ({ requestId: req.id }),
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
          remoteAddress: req.remoteAddress,
        };
      },
    },
  }),
);
app.use(helmet());
app.head("/", (_req, res) => res.sendStatus(204));
app.use((req, res, next) => {
  if (env.nodeEnv === "production" && !req.secure) {
    const error = new Error("HTTPS required");
    error.code = "HTTPS_REQUIRED";
    return next(error);
  }
  return next();
});
app.use(corsMiddleware);
app.use(compression());
app.use(express.json({ limit: "100kb" }));
app.use("/api", jsonOnly);
app.use(rateLimiters.default);

app.use(healthRoutes);
app.use("/api/me", meRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/uploads", uploadsRoutes);
app.use("/api/projects", projectsRoutes);
app.use("/api/services", servicesRoutes);
app.use("/api/meta", metaRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/jobs", jobsRoutes);
app.use("/api/applications", applicationsRoutes);
app.use("/api/battles", battlesRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/matches", matchesRoutes);
app.use("/api/support/tickets", supportRoutes);
app.use("/api/conversations", conversationsRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api", walletRoutes);
app.use(notFound);
app.use(errorHandler);
