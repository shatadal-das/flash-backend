import { z } from "zod";

export const createStoreSchema = z.object({
  name: z.string().min(2, "Store name must be at least 2 characters").max(100),
  description: z.string().max(500).optional(),
  address: z.string().min(3, "Address must be at least 3 characters").max(255),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export const updateStoreSchema = createStoreSchema.partial();

export const sizeStockItemSchema = z.object({
  size: z.string().min(1, "Size is required").max(50),
  stock: z.number().int("Stock must be an integer").min(0, "Stock cannot be negative"),
});

export const createProductSchema = z
  .object({
    name: z.string().min(2, "Product name must be at least 2 characters").max(100),
    description: z.string().min(5, "Product description must be at least 5 characters").max(1000),
    size: z.string().max(50).optional(),
    color: z.string().min(1, "Color is required (e.g. Black, White, Navy)").max(50),
    mrp: z.number().positive("MRP must be greater than 0"),
    currentSellingPrice: z.number().positive("Current selling price must be greater than 0"),
    price: z.number().positive().optional(),
    stock: z.number().int("Stock must be an integer").min(0, "Stock cannot be negative").optional(),
    sizes: z.array(sizeStockItemSchema).min(1).optional(),
    imageUrl: z.string().url("Invalid image URL").optional(),
  })
  .refine(
    (data) => (data.sizes && data.sizes.length > 0) || (Boolean(data.size) && data.stock !== undefined),
    {
      message: "Specify either a single size with stock or a list of sizes with stock",
      path: ["sizes"],
    }
  );

export const updateProductSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().min(5).max(1000).optional(),
  size: z.string().max(50).optional(),
  color: z.string().max(50).optional(),
  mrp: z.number().positive().optional(),
  currentSellingPrice: z.number().positive().optional(),
  price: z.number().positive().optional(),
  stock: z.number().int().min(0).optional(),
  imageUrl: z.string().url().optional(),
});

export type CreateStoreInput = z.infer<typeof createStoreSchema>;
export type UpdateStoreInput = z.infer<typeof updateStoreSchema>;
export type SizeStockItem = z.infer<typeof sizeStockItemSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
