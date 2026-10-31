export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(details, message = "Request validation failed") {
    super(400, "VALIDATION_ERROR", message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(code = "UNAUTHORIZED", message = "Authentication is required") {
    super(401, code, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You are not allowed to perform this action") {
    super(403, "FORBIDDEN", message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(404, "NOT_FOUND", message);
  }
}

export class ConflictError extends AppError {
  constructor(
    message = "The request conflicts with the current resource state",
  ) {
    super(409, "CONFLICT", message);
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Too many requests") {
    super(429, "RATE_LIMIT_EXCEEDED", message);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = "Service is temporarily unavailable") {
    super(503, "SERVICE_UNAVAILABLE", message);
  }
}
