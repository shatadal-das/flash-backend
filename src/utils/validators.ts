import { z } from "zod";

const ROLES = ["ADMIN", "VENDOR", "DELIVERY", "CUSTOMER"] as const;

// ─── Auth Schemas ──────────────────────────────────────────
export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be at most 128 characters"),
  name: z.string().min(1, "Name is required").max(100),
  phone: z.string().optional(),
  role: z.enum(ROLES).default("CUSTOMER"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

// ─── Vendor / Store Schemas ────────────────────────────────
export const createStoreSchema = z.object({
  name: z.string().min(2, "Store name must be at least 2 characters").max(100),
  description: z.string().max(500).optional(),
  address: z.string().min(3, "Address must be at least 3 characters").max(255),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

// ─── Product Schemas ───────────────────────────────────────
export const createProductSchema = z.object({
  name: z.string().min(2, "Product name must be at least 2 characters").max(100),
  description: z.string().min(5, "Product description must be at least 5 characters").max(1000),
  size: z.string().min(1, "Size is required (e.g. S, M, L, XL, 32)").max(50),
  color: z.string().min(1, "Color is required (e.g. Black, White, Navy)").max(50),
  mrp: z.number().positive("MRP must be greater than 0"),
  currentSellingPrice: z.number().positive("Current selling price must be greater than 0"),
  price: z.number().positive().optional(),
  stock: z.number().int("Stock must be an integer").min(0, "Stock cannot be negative"),
  imageUrl: z.string().url("Invalid image URL").optional(),
});

export const updateProductSchema = createProductSchema.partial();

// ─── Coupon Schemas ────────────────────────────────────────
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

// ─── Delivery Info Schemas ─────────────────────────────────
export const deliveryInfoSchema = z.object({
  label: z.string().min(1, "Label is required").max(50).default("Home"),
  name: z.string().min(2, "Recipient name is required").max(100),
  phone: z.string().min(7, "Phone number must be at least 7 digits").max(20),
  email: z.string().email("Valid email is required"),
  address: z.string().min(5, "Full street address must be at least 5 characters").max(255),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  pincode: z.string().max(20).optional(),
  isDefault: z.boolean().default(false),
});

export const updateDeliveryInfoSchema = deliveryInfoSchema.partial();

// ─── Order Schemas ─────────────────────────────────────────
export const orderItemInputSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  quantity: z.number().int("Quantity must be an integer").positive("Quantity must be at least 1"),
});

export const createOrderSchema = z.object({
  items: z
    .array(orderItemInputSchema)
    .min(1, "Order must contain at least one product item"),
  deliveryAddress: z
    .string()
    .min(5, "Delivery address must be at least 5 characters")
    .max(255),
  deliveryPhone: z.string().optional(),
  deliveryEmail: z.string().email().optional(),
  couponCode: z.string().optional(),
  deliveryLatitude: z.number().min(-90).max(90).optional(),
  deliveryLongitude: z.number().min(-180).max(180).optional(),
});

// ─── Export Inferred Types ─────────────────────────────────
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;

export type CreateStoreInput = z.infer<typeof createStoreSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export type CreateCouponInput = z.infer<typeof createCouponSchema>;
export type ValidateCouponInput = z.infer<typeof validateCouponSchema>;

export type DeliveryInfoInput = z.infer<typeof deliveryInfoSchema>;
export type UpdateDeliveryInfoInput = z.infer<typeof updateDeliveryInfoSchema>;

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type OrderItemInput = z.infer<typeof orderItemInputSchema>;
