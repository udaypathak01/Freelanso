import { AppError } from "../utils/AppError.js";

export function jsonOnly(req, res, next) {
  const hasBody =
    req.headers["content-length"] !== undefined ||
    req.headers["transfer-encoding"] !== undefined;
  const isWrite = !["GET", "HEAD", "OPTIONS"].includes(req.method);

  if (isWrite && hasBody && !req.is("application/json")) {
    return next(
      new AppError(415, "UNSUPPORTED_MEDIA_TYPE", "Request body must be JSON"),
    );
  }
  return next();
}
