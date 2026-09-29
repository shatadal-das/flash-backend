import { Request, Response } from "express";
import { deliveryService } from "../services/delivery.service";
import { createAppError } from "../middlewares/errorHandler";

export const deliveryController = {
  async getAvailableOrders(_req: Request, res: Response): Promise<void> {
    const orders = await deliveryService.getAvailableOrders();
    res.status(200).json({ success: true, data: orders });
  },

  async acceptOrder(req: Request, res: Response): Promise<void> {
    if (!req.user) throw createAppError("Authentication required", 401);
    const orderId = req.params.orderId as string;
    const order = await deliveryService.acceptOrder(req.user.userId, orderId);
    res.status(200).json({ success: true, data: order });
  },

  async completeDelivery(req: Request, res: Response): Promise<void> {
    if (!req.user) throw createAppError("Authentication required", 401);
    const orderId = req.params.orderId as string;
    const order = await deliveryService.completeDelivery(
      req.user.userId,
      orderId
    );
    res.status(200).json({ success: true, data: order });
  },

  async getMyDeliveries(req: Request, res: Response): Promise<void> {
    if (!req.user) throw createAppError("Authentication required", 401);
    const orders = await deliveryService.getMyDeliveries(req.user.userId);
    res.status(200).json({ success: true, data: orders });
  },
};
