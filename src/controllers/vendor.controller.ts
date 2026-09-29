import { Request, Response } from "express";
import { vendorService } from "../services/vendor.service";
import { createAppError } from "../middlewares/errorHandler";

export const vendorController = {
  async createStore(req: Request, res: Response): Promise<void> {
    if (!req.user) throw createAppError("Authentication required", 401);
    const store = await vendorService.createStore(req.user.userId, req.body);
    res.status(201).json({ success: true, data: store });
  },

  async getStore(req: Request, res: Response): Promise<void> {
    if (!req.user) throw createAppError("Authentication required", 401);
    const store = await vendorService.getStore(req.user.userId, false);
    res.status(200).json({ success: true, data: store });
  },

  async createProduct(req: Request, res: Response): Promise<void> {
    if (!req.user) throw createAppError("Authentication required", 401);
    const product = await vendorService.createProduct(req.user.userId, req.body);
    res.status(201).json({ success: true, data: product });
  },

  async getProducts(req: Request, res: Response): Promise<void> {
    if (!req.user) throw createAppError("Authentication required", 401);
    const products = await vendorService.getProducts(req.user.userId);
    res.status(200).json({ success: true, data: products });
  },

  async getProductById(req: Request, res: Response): Promise<void> {
    if (!req.user) throw createAppError("Authentication required", 401);
    const id = req.params.id as string;
    const product = await vendorService.getProductById(req.user.userId, id);
    res.status(200).json({ success: true, data: product });
  },

  async updateProduct(req: Request, res: Response): Promise<void> {
    if (!req.user) throw createAppError("Authentication required", 401);
    const id = req.params.id as string;
    const product = await vendorService.updateProduct(
      req.user.userId,
      id,
      req.body
    );
    res.status(200).json({ success: true, data: product });
  },

  async deleteProduct(req: Request, res: Response): Promise<void> {
    if (!req.user) throw createAppError("Authentication required", 401);
    const id = req.params.id as string;
    const result = await vendorService.deleteProduct(req.user.userId, id);
    res.status(200).json({ success: true, data: result });
  },

  async getStoreOrders(req: Request, res: Response): Promise<void> {
    if (!req.user) throw createAppError("Authentication required", 401);
    const orders = await vendorService.getStoreOrders(req.user.userId);
    res.status(200).json({ success: true, data: orders });
  },
};
