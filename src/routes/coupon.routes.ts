import { Router, Request, Response } from "express";
import { couponService } from "../services/coupon.service";
import { asyncHandler } from "../middlewares/asyncHandler";
import { validateBody } from "../middlewares/validate";
import { verifyToken, requireRole } from "../middlewares/auth";
import { createCouponSchema, validateCouponSchema } from "../utils/validators";

const router = Router();

// GET /api/coupons - List active public promotions
router.get(
  "/",
  asyncHandler(async (_req: Request, res: Response) => {
    // Ensure default demo coupons are present
    await couponService.seedDefaultCoupons();
    const coupons = await couponService.getActiveCoupons();
    res.status(200).json({ success: true, data: coupons });
  })
);

// POST /api/coupons/validate - Validate coupon code with order subtotal
router.post(
  "/validate",
  validateBody(validateCouponSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { code, orderAmount } = req.body;
    const result = await couponService.validateCoupon(code, Number(orderAmount));
    res.status(200).json({ success: result.valid, ...result });
  })
);

// POST /api/coupons - Create new coupon (Admin or Vendor)
router.post(
  "/",
  verifyToken,
  requireRole(["ADMIN", "VENDOR"]),
  validateBody(createCouponSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const coupon = await couponService.createCoupon(req.body);
    res.status(201).json({
      success: true,
      message: "Coupon created successfully",
      data: coupon,
    });
  })
);

export default router;
