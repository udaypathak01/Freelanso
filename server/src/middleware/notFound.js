import { NotFoundError } from "../utils/AppError.js";

export function notFound(req, res, next) {
  next(new NotFoundError("Route not found"));
}
