import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config/env";
import { createAppError } from "./error";
import { queryOne } from "../database/query";

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

export async function verifyToken(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(createAppError("Access token required", 401));
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, config.jwtAccessSecret) as JwtPayload;
    const user = await queryOne<{ id: string; role: JwtPayload["role"] }>(
      "SELECT id, role FROM users WHERE id = $1",
      [decoded.userId]
    );
    if (!user) {
      return next(createAppError("User session no longer valid. Please sign in again.", 401));
    }
    req.user = { userId: user.id, role: user.role };
    next();
  } catch {
    return next(createAppError("Invalid or expired access token", 401));
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
