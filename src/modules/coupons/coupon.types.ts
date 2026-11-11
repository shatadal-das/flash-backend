import { z } from "zod";

export const createCouponSchema = z.object({
  code: z
    .string()
    .min(3, "Coupon code must be at least 3 characters")
    .max(30)
    .toUpperCase(),
  description: z.string().max(255).optional(),
  discountType: z.enum(["PERCENTAGE", "FIXED"]).default("PERCENTAGE"),
  discountValue: z.number().positive("Discount value must be greater than 0"),
  minOrderAmount: z.number().min(0, "Minimum order amount cannot be negative").default(0),
  maxDiscount: z.number().positive("Maximum discount must be positive").optional(),
  expiresAt: z.string().datetime().optional(),
  isActive: z.boolean().default(true),
  usageLimit: z.number().int().positive().optional(),
});

export const validateCouponSchema = z.object({
  code: z.string().min(1, "Coupon code is required").toUpperCase(),
  orderAmount: z.number().min(0, "Order amount is required"),
});

export type CreateCouponInput = z.infer<typeof createCouponSchema>;
export type ValidateCouponInput = z.infer<typeof validateCouponSchema>;

