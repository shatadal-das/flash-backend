import { Request, Response, NextFunction } from "express";
import { config } from "../config/env";

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export function createAppError(message: string, statusCode = 500): AppError {
  const error: AppError = new Error(message);
  error.statusCode = statusCode;
  error.isOperational = true;
  return error;
}

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode || 500;
  const isOperational = err.isOperational ?? false;
  const message = isOperational ? err.message : "Internal Server Error";

  if (statusCode >= 500) {
    console.error(`[ERROR] ${statusCode} - ${err.message}`, err.stack);
  }

  res.status(statusCode).json({
    success: false,
    message,
    error: {
      message,
      ...(config.nodeEnv === "development" && { stack: err.stack }),
    },
  });
}

