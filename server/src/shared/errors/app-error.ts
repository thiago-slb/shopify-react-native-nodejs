export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly logDetails?: unknown;

  constructor(
    message: string,
    statusCode = 500,
    code = 'INTERNAL_SERVER_ERROR',
    details?: unknown,
    logDetails?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.logDetails = logDetails;
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details?: unknown) {
    super(message, 404, 'NOT_FOUND', details);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', details?: unknown, code = 'BAD_REQUEST', logDetails?: unknown) {
    super(message, 400, code, details, logDetails);
  }
}

export class UpstreamError extends AppError {
  constructor(message = 'Upstream service error', details?: unknown) {
    super(message, 502, 'UPSTREAM_SERVICE_ERROR', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required', details?: unknown) {
    super(message, 401, 'AUTHENTICATION_REQUIRED', details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', details?: unknown) {
    super(message, 403, 'CART_OWNERSHIP_MISMATCH', details);
  }
}
