import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config/env";
import { createAppError } from "./error";

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

export function verifyToken(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw createAppError("Access token required", 401);
  }

  const token = authHeader.split(" ")[1];
  try {
    req.user = jwt.verify(token, config.jwtAccessSecret) as JwtPayload;
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

