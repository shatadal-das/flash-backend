import { Request, Response } from "express";
import * as deliveryInfoService from "./delivery-info.service";

export async function handleListAddresses(req: Request, res: Response) {
  const list = await deliveryInfoService.listAddresses(req.user!.userId);
  res.status(200).json({ success: true, data: list });
}

export async function handleCreateAddress(req: Request, res: Response) {
  const created = await deliveryInfoService.createAddress(req.user!.userId, req.body);
  res.status(201).json({
    success: true,
    message: "Delivery info saved successfully",
    data: created,
  });
}

export async function handleUpdateAddress(req: Request, res: Response) {
  const updated = await deliveryInfoService.updateAddress(
    req.user!.userId,
    req.params.id as string,
    req.body
  );
  res.status(200).json({
    success: true,
    message: "Delivery info updated successfully",
    data: updated,
  });
}

export async function handleDeleteAddress(req: Request, res: Response) {
  await deliveryInfoService.deleteAddress(req.user!.userId, req.params.id as string);
  res.status(200).json({
    success: true,
    message: "Delivery info removed successfully",
  });
}

export async function handleSetDefaultAddress(req: Request, res: Response) {
  const updated = await deliveryInfoService.setDefaultAddress(
    req.user!.userId,
    req.params.id as string
  );
  res.status(200).json({
    success: true,
    message: "Default delivery address updated",
    data: updated,
  });
}

