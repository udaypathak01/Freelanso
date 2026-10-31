import { ForbiddenError } from "../utils/AppError.js";

export function requireRole(...allowedRoles) {
  return function roleGuard(req, res, next) {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      req.log?.warn(
        {
          requestId: req.id,
          uid: req.user?.uid,
          authorizationFailure: true,
        },
        "Authorization denied",
      );
      return next(new ForbiddenError());
    }
    return next();
  };
}
