import { z } from "zod";

export const createStoreSchema = z.object({
  name: z.string().min(2, "Store name must be at least 2 characters").max(100),
  description: z.string().max(500).optional(),
  address: z.string().min(3, "Address must be at least 3 characters").max(255),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

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

export type CreateStoreInput = z.infer<typeof createStoreSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

