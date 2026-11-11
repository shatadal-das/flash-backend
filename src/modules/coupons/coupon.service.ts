import crypto from "crypto";
import { query, queryOne } from "../../database/query";
import { createAppError } from "../../middleware/error";
import { CreateCouponInput, ValidateCouponInput } from "./coupon.types";

export async function seedDefaultCoupons(): Promise<void> {
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

export async function getActiveCoupons() {
  await seedDefaultCoupons();

  const coupons = await query(
    "SELECT * FROM coupons WHERE is_active = true ORDER BY created_at DESC"
  );

  const now = Date.now();
  return coupons.filter((c) => {
    if (c.expiresAt && new Date(c.expiresAt).getTime() < now) return false;
    if (c.usageLimit !== null && c.usedCount >= c.usageLimit) return false;
    return true;
  });
}

export async function validateCoupon(input: ValidateCouponInput) {
  const normalizedCode = input.code.toUpperCase().trim();
  const coupon = await queryOne("SELECT * FROM coupons WHERE code = $1", [normalizedCode]);

  if (!coupon) {
    return {
      success: false,
      valid: false,
      message: `Coupon code "${normalizedCode}" does not exist.`,
      discountAmount: 0,
      finalTotal: input.orderAmount,
    };
  }

  if (!coupon.isActive) {
    return {
      success: false,
      valid: false,
      message: `Coupon code "${normalizedCode}" is currently inactive.`,
      discountAmount: 0,
      finalTotal: input.orderAmount,
    };
  }

  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now()) {
    return {
      success: false,
      valid: false,
      message: `Coupon code "${normalizedCode}" has expired.`,
      discountAmount: 0,
      finalTotal: input.orderAmount,
    };
  }

  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    return {
      success: false,
      valid: false,
      message: `Coupon code "${normalizedCode}" has reached its maximum usage limit.`,
      discountAmount: 0,
      finalTotal: input.orderAmount,
    };
  }

  if (input.orderAmount < coupon.minOrderAmount) {
    return {
      success: false,
      valid: false,
      message: `Minimum order amount of $${coupon.minOrderAmount.toFixed(2)} required for this coupon.`,
      discountAmount: 0,
      finalTotal: input.orderAmount,
    };
  }

  let discount = 0;
  if (coupon.discountType === "PERCENTAGE") {
    discount = input.orderAmount * (coupon.discountValue / 100);
    if (coupon.maxDiscount !== null && coupon.maxDiscount > 0) {
      discount = Math.min(discount, coupon.maxDiscount);
    }
  } else {
    discount = Math.min(coupon.discountValue, input.orderAmount);
  }

  discount = Math.round(discount * 100) / 100;
  const finalTotal = Math.max(0, Math.round((input.orderAmount - discount) * 100) / 100);

  return {
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
  };
}

export async function createCoupon(input: CreateCouponInput) {
  const code = input.code.toUpperCase().trim();
  const existing = await queryOne("SELECT id FROM coupons WHERE code = $1", [code]);
  if (existing) {
    throw createAppError(`Coupon with code "${code}" already exists`, 400);
  }

  const couponId = crypto.randomUUID();
  return await queryOne(
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
}

