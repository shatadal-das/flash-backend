import { Request, Response } from "express";
import { authService } from "../services/auth.service";
import { createAppError } from "../middlewares/errorHandler";
import {
  registerSchema,
  loginSchema,
  refreshSchema,
} from "../utils/validators";

export const authController = {
  async register(req: Request, res: Response): Promise<void> {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      throw createAppError(
        parsed.error.issues.map((i) => i.message).join(", "),
        400
      );
    }

    const result = await authService.register(parsed.data);

    res.status(201).json({
      success: true,
      data: result,
    });
  },

  async login(req: Request, res: Response): Promise<void> {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw createAppError(
        parsed.error.issues.map((i) => i.message).join(", "),
        400
      );
    }

    const result = await authService.login(parsed.data);

    res.status(200).json({
      success: true,
      data: result,
    });
  },

  async refresh(req: Request, res: Response): Promise<void> {
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) {
      throw createAppError(
        parsed.error.issues.map((i) => i.message).join(", "),
        400
      );
    }

    const result = await authService.refreshToken(parsed.data.refreshToken);

    res.status(200).json({
      success: true,
      data: result,
    });
  },

  async logout(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw createAppError("Authentication required", 401);
    }

    await authService.logout(req.user.userId);

    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  },
};
