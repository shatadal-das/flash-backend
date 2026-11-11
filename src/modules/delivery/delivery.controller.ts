import { Request, Response } from "express";
import * as deliveryService from "./delivery.service";

export async function handleListAvailableOrders(_req: Request, res: Response) {
  const orders = await deliveryService.getAvailableOrders();
  res.status(200).json({ success: true, data: orders });
}

export async function handleAcceptOrder(req: Request, res: Response) {
  const order = await deliveryService.acceptOrder(
    req.user!.userId,
    req.params.orderId as string
  );
  res.status(200).json({ success: true, data: order });
}

export async function handleCompleteDelivery(req: Request, res: Response) {
  const order = await deliveryService.completeDelivery(
    req.user!.userId,
    req.params.orderId as string
  );
  res.status(200).json({ success: true, data: order });
}

export async function handleListMyDeliveries(req: Request, res: Response) {
  const orders = await deliveryService.getMyDeliveries(req.user!.userId);
  res.status(200).json({ success: true, data: orders });
}

