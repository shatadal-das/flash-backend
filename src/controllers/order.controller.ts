import { Request, Response } from "express";
import { orderService } from "../services/order.service";
import { createAppError } from "../middlewares/errorHandler";

export const orderController = {
  async createOrder(req: Request, res: Response): Promise<void> {
    if (!req.user) throw createAppError("Authentication required", 401);
    const order = await orderService.createOrder(req.user.userId, req.body);
    res.status(201).json({ success: true, data: order });
  },

  async getCustomerOrders(req: Request, res: Response): Promise<void> {
    if (!req.user) throw createAppError("Authentication required", 401);
    const orders = await orderService.getCustomerOrders(req.user.userId);
    res.status(200).json({ success: true, data: orders });
  },

  async getOrderById(req: Request, res: Response): Promise<void> {
    if (!req.user) throw createAppError("Authentication required", 401);
    const id = req.params.id as string;
    const order = await orderService.getOrderById(req.user.userId, id);
    res.status(200).json({ success: true, data: order });
  },
};
