/**
 * Custom error classes for structured API error handling
 */

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code: string = 'internal_error',
    public details?: Array<{ field: string; message: string; code: string }>
  ) {
    super(message);
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details }),
      },
    };
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string, id?: string) {
    super(404, id ? `${resource} '${id}' not found` : `${resource} not found`, 'not_found');
  }
}

export class ValidationError extends ApiError {
  constructor(details: Array<{ field: string; message: string; code: string }>) {
    super(422, 'Validation failed', 'validation_error', details);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Authentication required') {
    super(401, message, 'unauthorized');
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'Insufficient permissions') {
    super(403, message, 'forbidden');
  }
}

export class ConflictError extends ApiError {
  constructor(message: string) {
    super(409, message, 'conflict');
  }
}
