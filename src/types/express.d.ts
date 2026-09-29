/**
 * Extend Express Request to include authenticated user payload.
 */

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
