import { Request, Response } from "express";
import * as couponService from "./coupon.service";

export async function handleGetCoupons(_req: Request, res: Response) {
  const coupons = await couponService.getActiveCoupons();
  res.status(200).json({ success: true, data: coupons });
}

export async function handleValidateCoupon(req: Request, res: Response) {
  const result = await couponService.validateCoupon(req.body);
  res.status(200).json(result);
}

export async function handleCreateCoupon(req: Request, res: Response) {
  const coupon = await couponService.createCoupon(req.body);
  res.status(201).json({
    success: true,
    message: "Coupon created successfully",
    data: coupon,
  });
}

