import { auth } from "../config/firebase.js";
import { AppError, UnauthorizedError } from "../utils/AppError.js";

const validRoles = new Set(["freelancer", "client", "admin"]);

export async function authenticateOptional(req, res, next) {
  const authorization = req.get("authorization");
  if (!authorization) return next();
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return next(new UnauthorizedError("INVALID_AUTH_HEADER"));
  try {
    const decoded = await auth.verifyIdToken(match[1], true);
    req.user = {
      uid: decoded.uid,
      email: decoded.email ?? null,
      role: validRoles.has(decoded.role) ? decoded.role : null,
      emailVerified: decoded.email_verified === true,
      displayName: typeof decoded.name === "string" ? decoded.name : "",
      photoURL: typeof decoded.picture === "string" ? decoded.picture : null,
    };
    return next();
  } catch (error) {
    const knownAuthFailures = new Set([
      "auth/id-token-expired",
      "auth/id-token-revoked",
      "auth/invalid-id-token",
      "auth/argument-error",
      "auth/user-not-found",
      "auth/user-disabled",
    ]);
    if (knownAuthFailures.has(error?.code)) {
      const code =
        error.code === "auth/id-token-expired"
          ? "TOKEN_EXPIRED"
          : error.code === "auth/id-token-revoked"
            ? "TOKEN_REVOKED"
            : error.code === "auth/user-disabled"
              ? "ACCOUNT_DISABLED"
              : "INVALID_TOKEN";
      return next(new UnauthorizedError(code, "The authentication token is invalid"));
    }
    req.log?.error(
      { requestId: req.id, errorName: error?.name ?? "Error" },
      "Optional token verification service failed",
    );
    return next(
      new AppError(
        503,
        "AUTH_SERVICE_UNAVAILABLE",
        "Authentication service is unavailable",
      ),
    );
  }
}
