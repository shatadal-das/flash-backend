import { Request, Response } from "express";
import * as orderService from "./order.service";

export async function handlePackOrder(req: Request, res: Response) {
  const data = await orderService.packOrder(req.user!.userId, req.params.id as string);
  res.status(200).json({ success: true, data });
}

export async function handleCreateOrder(req: Request, res: Response) {
  const data = await orderService.createOrder(req.user!.userId, req.body);
  res.status(201).json({ success: true, data });
}

export async function handleListCustomerOrders(req: Request, res: Response) {
  const data = await orderService.getCustomerOrders(req.user!.userId);
  res.status(200).json({ success: true, data });
}

export async function handleGetCustomerOrder(req: Request, res: Response) {
  const data = await orderService.getCustomerOrderById(req.user!.userId, req.params.id as string);
  res.status(200).json({ success: true, data });
}

