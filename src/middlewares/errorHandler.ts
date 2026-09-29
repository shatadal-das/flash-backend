import { Request, Response, NextFunction } from "express";

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode || 500;
  const isOperational = err.isOperational ?? false;

  console.error(`[ERROR] ${statusCode} - ${err.message}`, {
    stack: err.stack,
    isOperational,
  });

  res.status(statusCode).json({
    success: false,
    error: {
      message: isOperational ? err.message : "Internal Server Error",
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    },
  });
}

/**
 * Factory for creating operational errors with status codes.
 */
export function createAppError(
  message: string,
  statusCode: number = 500
): AppError {
  const error: AppError = new Error(message);
  error.statusCode = statusCode;
  error.isOperational = true;
  return error;
}
