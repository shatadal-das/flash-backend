import { Router, Request, Response } from "express";
import crypto from "crypto";
import { query, queryOne } from "../db";
import { verifyToken, requireRole, createAppError } from "../auth";
import {
  validateBody,
  createCouponSchema,
  validateCouponSchema,
  CreateCouponInput,
  ValidateCouponInput,
} from "../validators";

const router = Router();

async function seedDefaultCoupons() {
  const countRow = await queryOne<{ count: number }>("SELECT COUNT(*)::int AS count FROM coupons");
  if (countRow && countRow.count > 0) return;

  const defaults = [
    {
      code: "FLASH15",
      description: "15% off boutique order drop",
      discountType: "PERCENTAGE",
      discountValue: 15,
      minOrderAmount: 20,
      maxDiscount: 50,
    },
    {
      code: "WELCOME20",
      description: "20% off your first 15-minute quick delivery",
      discountType: "PERCENTAGE",
      discountValue: 20,
      minOrderAmount: 30,
      maxDiscount: 80,
    },
    {
      code: "FLAT50",
      description: "$50 off high-value boutique bundles over $150",
      discountType: "FIXED",
      discountValue: 50,
      minOrderAmount: 150,
      maxDiscount: null,
    },
  ];

  for (const c of defaults) {
    await query(
      `INSERT INTO coupons (id, code, description, discount_type, discount_value, min_order_amount, max_discount, is_active, used_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true, 0)
       ON CONFLICT (code) DO NOTHING`,
      [
        crypto.randomUUID(),
        c.code,
        c.description,
        c.discountType,
        c.discountValue,
        c.minOrderAmount,
        c.maxDiscount,
      ]
    );
  }
}

router.get("/", async (_req: Request, res: Response) => {
  await seedDefaultCoupons();

  const coupons = await query(
    "SELECT * FROM coupons WHERE is_active = true ORDER BY created_at DESC"
  );

  const now = Date.now();
  const activeCoupons = coupons.filter((c) => {
    if (c.expiresAt && new Date(c.expiresAt).getTime() < now) return false;
    if (c.usageLimit !== null && c.usedCount >= c.usageLimit) return false;
    return true;
  });

  res.status(200).json({ success: true, data: activeCoupons });
});

router.post("/validate", validateBody(validateCouponSchema), async (req: Request, res: Response) => {
  const { code, orderAmount }: ValidateCouponInput = req.body;
  const normalizedCode = code.toUpperCase().trim();

  const coupon = await queryOne("SELECT * FROM coupons WHERE code = $1", [normalizedCode]);

  if (!coupon) {
    res.status(200).json({
      success: false,
      valid: false,
      message: `Coupon code "${normalizedCode}" does not exist.`,
      discountAmount: 0,
      finalTotal: orderAmount,
    });
    return;
  }

  if (!coupon.isActive) {
    res.status(200).json({
      success: false,
      valid: false,
      message: `Coupon code "${normalizedCode}" is currently inactive.`,
      discountAmount: 0,
      finalTotal: orderAmount,
    });
    return;
  }

  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now()) {
    res.status(200).json({
      success: false,
      valid: false,
      message: `Coupon code "${normalizedCode}" has expired.`,
      discountAmount: 0,
      finalTotal: orderAmount,
    });
    return;
  }

  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    res.status(200).json({
      success: false,
      valid: false,
      message: `Coupon code "${normalizedCode}" has reached its maximum usage limit.`,
      discountAmount: 0,
      finalTotal: orderAmount,
    });
    return;
  }

  if (orderAmount < coupon.minOrderAmount) {
    res.status(200).json({
      success: false,
      valid: false,
      message: `Minimum order amount of $${coupon.minOrderAmount.toFixed(2)} required for this coupon.`,
      discountAmount: 0,
      finalTotal: orderAmount,
    });
    return;
  }

  let discount = 0;
  if (coupon.discountType === "PERCENTAGE") {
    discount = orderAmount * (coupon.discountValue / 100);
    if (coupon.maxDiscount !== null && coupon.maxDiscount > 0) {
      discount = Math.min(discount, coupon.maxDiscount);
    }
  } else {
    discount = Math.min(coupon.discountValue, orderAmount);
  }

  discount = Math.round(discount * 100) / 100;
  const finalTotal = Math.max(0, Math.round((orderAmount - discount) * 100) / 100);

  res.status(200).json({
    success: true,
    valid: true,
    message: `Coupon applied: ${
      coupon.discountType === "PERCENTAGE"
        ? `${coupon.discountValue}% OFF`
        : `$${coupon.discountValue.toFixed(2)} OFF`
    }`,
    coupon: {
      id: coupon.id,
      code: coupon.code,
      description: coupon.description,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      minOrderAmount: coupon.minOrderAmount,
      maxDiscount: coupon.maxDiscount,
    },
    discountAmount: discount,
    finalTotal,
  });
});

router.post(
  "/",
  verifyToken,
  requireRole(["ADMIN", "VENDOR"]),
  validateBody(createCouponSchema),
  async (req: Request, res: Response) => {
    const input: CreateCouponInput = req.body;
    const code = input.code.toUpperCase().trim();

    const existing = await queryOne("SELECT id FROM coupons WHERE code = $1", [code]);
    if (existing) {
      throw createAppError(`Coupon with code "${code}" already exists`, 400);
    }

    const couponId = crypto.randomUUID();
    const coupon = await queryOne(
      `INSERT INTO coupons (
         id, code, description, discount_type, discount_value,
         min_order_amount, max_discount, expires_at, is_active,
         usage_limit, used_count
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0)
       RETURNING *`,
      [
        couponId,
        code,
        input.description ?? null,
        input.discountType,
        input.discountValue,
        input.minOrderAmount ?? 0,
        input.maxDiscount ?? null,
        input.expiresAt ? new Date(input.expiresAt) : null,
        input.isActive ?? true,
        input.usageLimit ?? null,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Coupon created successfully",
      data: coupon,
    });
  }
);

export default router;
