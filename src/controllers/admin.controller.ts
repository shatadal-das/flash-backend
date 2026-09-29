import { Request, Response } from "express";
import { adminService } from "../services/admin.service";

export const adminController = {
  async getDashboard(_req: Request, res: Response): Promise<void> {
    const dashboard = await adminService.getDashboard();
    res.status(200).json({ success: true, data: dashboard });
  },
};
