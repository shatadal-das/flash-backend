import { Request, Response } from "express";
import * as adminService from "./admin.service";

export async function handleGetDashboard(_req: Request, res: Response) {
  const data = await adminService.getDashboardData();
  res.status(200).json({ success: true, data });
}

