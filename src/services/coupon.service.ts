import { db } from "../config";
import { createAppError } from "../middlewares/errorHandler";
import type { CreateCouponInput } from "../utils/validators";

export interface CouponValidationResult {
  valid: boolean;
  message?: string;
  coupon?: {
    id: string;
    code: string;
    description?: string | null;
    discountType: "PERCENTAGE" | "FIXED";
    discountValue: number;
    minOrderAmount: number;
    maxDiscount?: number | null;
  };
  discountAmount: number;
  finalTotal: number;
}

export const couponService = {
  /**
   * Create a new promotional coupon code.
   */
  async createCoupon(input: CreateCouponInput) {
    const code = input.code.toUpperCase().trim();
    const existing = await db.orm.public.Coupon.where((c) => c.code.eq(code)).first();

    if (existing) {
      throw createAppError(`Coupon with code "${code}" already exists`, 400);
    }

    const coupon = await db.orm.public.Coupon.create({
      code,
      description: input.description ?? null,
      discountType: input.discountType,
      discountValue: input.discountValue,
      minOrderAmount: input.minOrderAmount ?? 0,
      maxDiscount: input.maxDiscount ?? null,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      isActive: input.isActive ?? true,
      usageLimit: input.usageLimit ?? null,
      usedCount: 0,
    });

    return coupon;
  },

  /**
   * Validate a coupon against an order subtotal.
   */
  async validateCoupon(code: string, orderAmount: number): Promise<CouponValidationResult> {
    const normalizedCode = code.toUpperCase().trim();
    const coupon = await db.orm.public.Coupon.where((c) =>
      c.code.eq(normalizedCode)
    ).first();

    if (!coupon) {
      return {
        valid: false,
        message: `Coupon code "${normalizedCode}" does not exist.`,
        discountAmount: 0,
        finalTotal: orderAmount,
      };
    }

    if (!coupon.isActive) {
      return {
        valid: false,
        message: `Coupon code "${normalizedCode}" is currently inactive.`,
        discountAmount: 0,
        finalTotal: orderAmount,
      };
    }

    if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now()) {
      return {
        valid: false,
        message: `Coupon code "${normalizedCode}" has expired.`,
        discountAmount: 0,
        finalTotal: orderAmount,
      };
    }

    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      return {
        valid: false,
        message: `Coupon code "${normalizedCode}" has reached its maximum usage limit.`,
        discountAmount: 0,
        finalTotal: orderAmount,
      };
    }

    if (orderAmount < coupon.minOrderAmount) {
      return {
        valid: false,
        message: `Minimum order amount of $${coupon.minOrderAmount.toFixed(2)} required for this coupon.`,
        discountAmount: 0,
        finalTotal: orderAmount,
      };
    }

    // Calculate discount amount
    let discount = 0;
    if (coupon.discountType === "PERCENTAGE") {
      discount = orderAmount * (coupon.discountValue / 100);
      if (coupon.maxDiscount !== null && coupon.maxDiscount > 0) {
        discount = Math.min(discount, coupon.maxDiscount);
      }
    } else {
      // FIXED discount
      discount = Math.min(coupon.discountValue, orderAmount);
    }

    discount = Math.round(discount * 100) / 100;
    const finalTotal = Math.max(0, Math.round((orderAmount - discount) * 100) / 100);

    return {
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
        discountType: coupon.discountType as "PERCENTAGE" | "FIXED",
        discountValue: coupon.discountValue,
        minOrderAmount: coupon.minOrderAmount,
        maxDiscount: coupon.maxDiscount,
      },
      discountAmount: discount,
      finalTotal,
    };
  },

  /**
   * Get all active and valid coupons (for promotional display).
   */
  async getActiveCoupons() {
    const coupons = await db.orm.public.Coupon.where((c) => c.isActive.eq(true))
      .orderBy((c) => c.createdAt.desc())
      .all();

    const now = Date.now();
    return coupons.filter((c) => {
      if (c.expiresAt && new Date(c.expiresAt).getTime() < now) return false;
      if (c.usageLimit !== null && c.usedCount >= c.usageLimit) return false;
      return true;
    });
  },

  /**
   * Seed default coupons if none exist.
   */
  async seedDefaultCoupons() {
    const count = (await db.orm.public.Coupon.all()).length;
    if (count > 0) return;

    await this.createCoupon({
      code: "FLASH15",
      description: "15% off boutique order drop",
      discountType: "PERCENTAGE",
      discountValue: 15,
      minOrderAmount: 20,
      maxDiscount: 50,
      isActive: true,
    });

    await this.createCoupon({
      code: "WELCOME20",
      description: "20% off your first 15-minute quick delivery",
      discountType: "PERCENTAGE",
      discountValue: 20,
      minOrderAmount: 30,
      maxDiscount: 80,
      isActive: true,
    });

    await this.createCoupon({
      code: "FLAT50",
      description: "$50 off high-value boutique bundles over $150",
      discountType: "FIXED",
      discountValue: 50,
      minOrderAmount: 150,
      isActive: true,
    });
  },
};
