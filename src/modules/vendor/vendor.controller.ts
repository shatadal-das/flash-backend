import { Request, Response } from "express";
import * as vendorService from "./vendor.service";

export async function handleCreateStore(req: Request, res: Response) {
  const store = await vendorService.createStore(req.user!.userId, req.body);
  res.status(201).json({ success: true, data: store });
}

export async function handleGetStore(req: Request, res: Response) {
  const store = await vendorService.getStore(req.user!.userId);
  res.status(200).json({ success: true, data: store || null });
}

export async function handleCreateProduct(req: Request, res: Response) {
  const product = await vendorService.createProduct(req.user!.userId, req.body);
  res.status(201).json({ success: true, data: product });
}

export async function handleListProducts(req: Request, res: Response) {
  const products = await vendorService.getStoreProducts(req.user!.userId);
  res.status(200).json({ success: true, data: products });
}

export async function handleGetProduct(req: Request, res: Response) {
  const product = await vendorService.getProductDetail(req.user!.userId, req.params.id as string);
  res.status(200).json({ success: true, data: product });
}

export async function handleUpdateProduct(req: Request, res: Response) {
  const updated = await vendorService.updateProduct(
    req.user!.userId,
    req.params.id as string,
    req.body
  );
  res.status(200).json({ success: true, data: updated });
}

export async function handleDeleteProduct(req: Request, res: Response) {
  await vendorService.deleteProduct(req.user!.userId, req.params.id as string);
  res.status(200).json({ success: true, data: { message: "Product deleted successfully" } });
}

export async function handleListOrders(req: Request, res: Response) {
  const orders = await vendorService.getStoreOrders(req.user!.userId);
  res.status(200).json({ success: true, data: orders });
}

