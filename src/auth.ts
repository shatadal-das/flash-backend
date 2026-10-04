import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface JwtPayload {
  userId: string;
  role: "ADMIN" | "VENDOR" | "DELIVERY" | "CUSTOMER";
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

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

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "fallback-access-secret";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "fallback-refresh-secret";
export const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60; // 7 days

export function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_ACCESS_SECRET, { expiresIn: "15m" });
}

export function generateRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: "7d" });
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_REFRESH_SECRET) as JwtPayload;
}

export function verifyToken(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw createAppError("Access token required", 401);
  }

  const token = authHeader.split(" ")[1];
  try {
    req.user = jwt.verify(token, JWT_ACCESS_SECRET) as JwtPayload;
    next();
  } catch {
    throw createAppError("Invalid or expired access token", 401);
  }
}

export function requireRole(allowedRoles: Array<JwtPayload["role"]>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw createAppError("Authentication required", 401);
    }
    if (!allowedRoles.includes(req.user.role)) {
      throw createAppError(
        `Forbidden: requires one of [${allowedRoles.join(", ")}]`,
        403
      );
    }
    next();
  };
}
