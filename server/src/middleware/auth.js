import { auth } from "../config/firebase.js";
import { AppError, UnauthorizedError } from "../utils/AppError.js";

function authFailureCode(error) {
  switch (error?.code) {
    case "auth/id-token-expired":
      return ["TOKEN_EXPIRED", "The authentication token has expired"];
    case "auth/id-token-revoked":
      return ["TOKEN_REVOKED", "The authentication token has been revoked"];
    case "auth/invalid-id-token":
    case "auth/argument-error":
    case "auth/user-not-found":
      return ["INVALID_TOKEN", "The authentication token is invalid"];
    case "auth/user-disabled":
      return ["ACCOUNT_DISABLED", "The account is disabled"];
    default:
      return null;
  }
}

export async function authenticate(req, res, next) {
  const authorization = req.get("authorization");
  const match = authorization?.match(/^Bearer ([^\s]+)$/i);
  if (!match) {
    req.log?.warn(
      { requestId: req.id, authFailure: "MISSING_TOKEN" },
      "Authentication failed",
    );
    return next(
      new UnauthorizedError("MISSING_TOKEN", "A Bearer token is required"),
    );
  }

  try {
    const decoded = await auth.verifyIdToken(match[1], true);
    const validRoles = new Set(["freelancer", "client", "admin"]);
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
    const failure = authFailureCode(error);
    if (!failure) {
      req.log?.error(
        { requestId: req.id, errorName: error?.name ?? "Error" },
        "Token verification service failed",
      );
      return next(
        new AppError(
          503,
          "AUTH_SERVICE_UNAVAILABLE",
          "Authentication service is unavailable",
        ),
      );
    }
    const [code, message] = failure;
    req.log?.warn(
      { requestId: req.id, authFailure: code },
      "Authentication failed",
    );
    return next(new UnauthorizedError(code, message));
  }
}

export async function authenticateOptional(req, res, next) {
  if (!req.get("authorization")) return next();
  return authenticate(req, res, next);
}
