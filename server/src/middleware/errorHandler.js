import { AppError } from "../utils/AppError.js";

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  const appError =
    error instanceof AppError
      ? error
      : error?.code === "CORS_ORIGIN_FORBIDDEN"
        ? new AppError(403, "CORS_ORIGIN_FORBIDDEN", "Origin is not allowed")
        : error?.code === "HTTPS_REQUIRED"
          ? new AppError(426, "HTTPS_REQUIRED", "HTTPS is required")
          : error?.type === "entity.too.large"
            ? new AppError(
                413,
                "PAYLOAD_TOO_LARGE",
                "Request body exceeds the 100kb limit",
              )
            : error instanceof SyntaxError && error.status === 400
              ? new AppError(
                  400,
                  "INVALID_JSON",
                  "Request body must contain valid JSON",
                )
              : new AppError(
                  500,
                  "INTERNAL_SERVER_ERROR",
                  "An unexpected error occurred",
                );

  if (!(error instanceof AppError)) {
    const stackTrace =
      error instanceof Error
        ? (error.stack?.split("\n").slice(1).join("\n") ?? "")
        : "";
    req.log?.error(
      {
        requestId: req.id,
        errorName: error?.name ?? "Error",
        stack_trace: stackTrace,
        serviceContext: {
          service: "freelanso-api",
          version: process.env.K_REVISION || process.env.GIT_SHA || "unknown",
        },
      },
      "Unhandled request error",
    );
  }

  return res.status(appError.status).json({
    success: false,
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.details ? { details: appError.details } : {}),
      requestId: req.id,
    },
  });
}
