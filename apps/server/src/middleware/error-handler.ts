/**
 * Centralized error handling middleware
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ApiError } from '../utils/errors.js';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json(err.toJSON());
    return;
  }

  if (err instanceof z.ZodError) {
    res.status(422).json({
      error: {
        code: 'validation_error',
        message: 'Request validation failed',
        details: err.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
          code: i.code,
        })),
      },
    });
    return;
  }

  // Log unexpected errors
  console.error('Unexpected error:', err);

  res.status(500).json({
    error: {
      code: 'internal_error',
      message: 'Internal server error',
    },
  });
}
