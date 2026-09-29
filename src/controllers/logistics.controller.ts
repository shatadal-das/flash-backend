import { Request, Response } from "express";
import { logisticsService } from "../services/logistics.service";
import { createAppError } from "../middlewares/errorHandler";

export const logisticsController = {
  async packOrder(req: Request, res: Response): Promise<void> {
    if (!req.user) throw createAppError("Authentication required", 401);
    const id = req.params.id as string;
    const order = await logisticsService.packOrder(req.user.userId, id);
    res.status(200).json({ success: true, data: order });
  },
};
