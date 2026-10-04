import { Router, Request, Response } from "express";
import crypto from "crypto";
import { query, queryOne } from "../db";
import { redis, STOCK_UPDATES_CHANNEL } from "../redis";
import { verifyToken, requireRole, createAppError } from "../auth";
import {
  validateBody,
  createStoreSchema,
  createProductSchema,
  updateProductSchema,
  CreateStoreInput,
  CreateProductInput,
  UpdateProductInput,
} from "../validators";

const router = Router();
router.use(verifyToken, requireRole(["VENDOR"]));

async function getOrCreateStore(vendorId: string) {
  let store = await queryOne("SELECT * FROM stores WHERE vendor_id = $1", [vendorId]);
  if (!store) {
    const storeId = crypto.randomUUID();
    store = await queryOne(
      `INSERT INTO stores (id, name, description, address, vendor_id)
       VALUES ($1, 'Flash Boutique Store', 'Curated fashion boutique', '123 Fashion Street', $2)
       RETURNING *`,
      [storeId, vendorId]
    );
  }
  return store;
}

router.post("/store", validateBody(createStoreSchema), async (req: Request, res: Response) => {
  const input: CreateStoreInput = req.body;
  const vendorId = req.user!.userId;

  const existing = await queryOne("SELECT id FROM stores WHERE vendor_id = $1", [vendorId]);
  if (existing) {
    throw createAppError("Vendor already has an active store", 400);
  }

  const storeId = crypto.randomUUID();
  const store = await queryOne(
    `INSERT INTO stores (id, name, description, address, latitude, longitude, vendor_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      storeId,
      input.name,
      input.description ?? null,
      input.address,
      input.latitude ?? null,
      input.longitude ?? null,
      vendorId,
    ]
  );

  res.status(201).json({ success: true, data: store });
});

router.get("/store", async (req: Request, res: Response) => {
  const store = await queryOne("SELECT * FROM stores WHERE vendor_id = $1", [
    req.user!.userId,
  ]);
  res.status(200).json({ success: true, data: store || null });
});

router.post("/products", validateBody(createProductSchema), async (req: Request, res: Response) => {
  const input: CreateProductInput = req.body;
  const store = await getOrCreateStore(req.user!.userId);

  const sellingPrice = input.currentSellingPrice ?? input.price ?? 0;
  const mrp = input.mrp ?? sellingPrice;
  const productId = crypto.randomUUID();

  const product = await queryOne(
    `INSERT INTO products (id, name, description, price, mrp, current_selling_price, size, color, stock, image_url, store_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      productId,
      input.name,
      input.description ?? null,
      sellingPrice,
      mrp,
      sellingPrice,
      input.size,
      input.color,
      input.stock,
      input.imageUrl ?? null,
      store.id,
    ]
  );

  try {
    await redis.publish(
      STOCK_UPDATES_CHANNEL,
      JSON.stringify({
        type: "product_added",
        product,
        timestamp: new Date().toISOString(),
      })
    );
  } catch (err) {
    console.error("Redis publish error:", err);
  }

  res.status(201).json({ success: true, data: product });
});

router.get("/products", async (req: Request, res: Response) => {
  const store = await getOrCreateStore(req.user!.userId);
  const products = await query(
    "SELECT * FROM products WHERE store_id = $1 ORDER BY created_at DESC",
    [store.id]
  );
  res.status(200).json({ success: true, data: products });
});

router.get("/products/:id", async (req: Request, res: Response) => {
  const store = await queryOne("SELECT id FROM stores WHERE vendor_id = $1", [req.user!.userId]);
  const product = await queryOne("SELECT * FROM products WHERE id = $1", [req.params.id]);

  if (!product) throw createAppError("Product not found", 404);
  if (!store || product.storeId !== store.id) {
    throw createAppError("Forbidden: Product does not belong to your store", 403);
  }

  res.status(200).json({ success: true, data: product });
});

router.put("/products/:id", validateBody(updateProductSchema), async (req: Request, res: Response) => {
  const input: UpdateProductInput = req.body;
  const store = await queryOne("SELECT id FROM stores WHERE vendor_id = $1", [req.user!.userId]);
  const product = await queryOne("SELECT * FROM products WHERE id = $1", [req.params.id]);

  if (!product) throw createAppError("Product not found", 404);
  if (!store || product.storeId !== store.id) {
    throw createAppError("Forbidden: Product does not belong to your store", 403);
  }

  const sellingPrice = input.currentSellingPrice ?? input.price;

  const updated = await queryOne(
    `UPDATE products SET
       name = COALESCE($2, name),
       description = CASE WHEN $3::text IS NOT NULL THEN $3 ELSE description END,
       price = COALESCE($4, price),
       current_selling_price = COALESCE($4, current_selling_price),
       mrp = COALESCE($5, mrp),
       size = COALESCE($6, size),
       color = COALESCE($7, color),
       stock = COALESCE($8, stock),
       image_url = CASE WHEN $9::text IS NOT NULL THEN $9 ELSE image_url END,
       updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      req.params.id,
      input.name ?? null,
      input.description ?? null,
      sellingPrice ?? null,
      input.mrp ?? null,
      input.size ?? null,
      input.color ?? null,
      input.stock ?? null,
      input.imageUrl ?? null,
    ]
  );

  try {
    await redis.publish(
      STOCK_UPDATES_CHANNEL,
      JSON.stringify({
        type: "product_updated",
        product: updated,
        timestamp: new Date().toISOString(),
      })
    );
  } catch (err) {
    console.error("Redis publish error:", err);
  }

  res.status(200).json({ success: true, data: updated });
});

router.delete("/products/:id", async (req: Request, res: Response) => {
  const store = await queryOne("SELECT id FROM stores WHERE vendor_id = $1", [req.user!.userId]);
  const product = await queryOne("SELECT * FROM products WHERE id = $1", [req.params.id]);

  if (!product) throw createAppError("Product not found", 404);
  if (!store || product.storeId !== store.id) {
    throw createAppError("Forbidden: Product does not belong to your store", 403);
  }

  await query("DELETE FROM products WHERE id = $1", [req.params.id]);

  try {
    await redis.publish(
      STOCK_UPDATES_CHANNEL,
      JSON.stringify({
        type: "product_deleted",
        productId: req.params.id,
        timestamp: new Date().toISOString(),
      })
    );
  } catch (err) {
    console.error("Redis publish error:", err);
  }

  res.status(200).json({ success: true, data: { message: "Product deleted successfully" } });
});

router.get("/orders", async (req: Request, res: Response) => {
  const store = await getOrCreateStore(req.user!.userId);
  const orders = await query(
    `SELECT o.*,
       COALESCE((SELECT json_agg(row_to_json(oi.*)) FROM order_items oi WHERE oi.order_id = o.id), '[]'::json) AS items,
       CASE WHEN c.id IS NULL THEN NULL ELSE json_build_object('id', c.id, 'name', c.name, 'email', c.email, 'phone', c.phone, 'role', c.role) END AS customer
     FROM orders o
     LEFT JOIN users c ON o.customer_id = c.id
     WHERE o.store_id = $1
     ORDER BY o.created_at DESC`,
    [store.id]
  );

  res.status(200).json({ success: true, data: orders });
});

export default router;
