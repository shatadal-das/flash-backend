import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { createAppError } from "./error";

export function validateBody<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.issues
        .map((issue) => `${issue.path.join(".") || "field"}: ${issue.message}`)
        .join("; ");
      throw createAppError(message, 400);
    }
    req.body = result.data;
    next();
  };
}

