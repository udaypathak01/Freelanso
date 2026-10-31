import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

let activeServer;
let shuttingDown = false;
let cloudinaryWorkerTimer;
let cloudinaryWorkerRunning = false;

export async function startServer() {
  const { env } = await import("./config/env.js");
  const { logger } = await import("./config/logger.js");
  const { processCloudinaryDeletionQueue } = await import(
    "./modules/projects/projects.service.js"
  );

  const runCloudinaryWorker = async () => {
    if (cloudinaryWorkerRunning) return;
    cloudinaryWorkerRunning = true;
    try {
      await processCloudinaryDeletionQueue();
    } catch (error) {
      logger.error(
        {
          errorName: error?.name ?? "Error",
          errorCode: error?.code,
          errorMessage: error?.message,
        },
        "Cloudinary deletion queue worker failed",
      );
    } finally {
      cloudinaryWorkerRunning = false;
    }
  };

  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    clearInterval(cloudinaryWorkerTimer);
    logger.info({ signal }, "Shutting down server");
    await new Promise((resolveClose) => {
      if (!activeServer?.listening) return resolveClose();
      const forceClose = setTimeout(
        () => activeServer.closeAllConnections?.(),
        10000,
      );
      activeServer.close(() => {
        clearTimeout(forceClose);
        resolveClose();
      });
    });
    logger.info("HTTP server closed");
    process.exit(0);
  };

  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.on("unhandledRejection", (reason) => {
    logger.fatal(
      { reasonName: reason?.name ?? typeof reason },
      "Unhandled promise rejection",
    );
    void shutdown("unhandledRejection");
  });
  process.on("uncaughtException", (error) => {
    logger.fatal({ errorName: error?.name ?? "Error" }, "Uncaught exception");
    void shutdown("uncaughtException");
  });

  const { app } = await import("./app.js");
  const server = app.listen(env.port);
  activeServer = server;
  server.requestTimeout = env.requestTimeoutMs;
  server.timeout = env.requestTimeoutMs;
  server.headersTimeout = Math.min(env.requestTimeoutMs, 60000);

  await new Promise((resolveListen, rejectListen) => {
    server.once("listening", resolveListen);
    server.once("error", rejectListen);
  });

  logger.info({ port: env.port }, "Freelanso API server listening");
  void runCloudinaryWorker();
  cloudinaryWorkerTimer = setInterval(() => void runCloudinaryWorker(), 30_000);
  cloudinaryWorkerTimer.unref();

  return server;
}

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMain) {
  startServer().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
