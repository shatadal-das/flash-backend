import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { createAppError } from "./errorHandler";
import type { JwtPayload } from "../types/express.d";

type Role = JwtPayload["role"];

/**
 * Extracts Bearer token, verifies it, and attaches decoded user to req.user.
 */
export function verifyToken(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw createAppError("Access token required", 401);
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
    req.user = decoded;
    next();
  } catch {
    throw createAppError("Invalid or expired access token", 401);
  }
}

/**
 * RBAC middleware factory. Checks if req.user.role is in the allowed list.
 */
export function requireRole(allowedRoles: Role[]) {
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
