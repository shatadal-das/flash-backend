import crypto from "crypto";
import { query, queryOne } from "../../database/query";
import { redis } from "../../events/redis";
import { STOCK_UPDATES_CHANNEL } from "../../events/channels";
import { createAppError } from "../../middleware/error";
import { CreateStoreInput, UpdateStoreInput, CreateProductInput, UpdateProductInput } from "./vendor.types";

export async function getOrCreateStore(vendorId: string) {
  let store = await queryOne("SELECT * FROM stores WHERE vendor_id = $1", [vendorId]);
  if (!store) {
    const user = await queryOne("SELECT id FROM users WHERE id = $1", [vendorId]);
    if (!user) {
      throw createAppError("User session no longer valid. Please sign in again.", 401);
    }
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

export async function createStore(vendorId: string, input: CreateStoreInput) {
  const user = await queryOne("SELECT id FROM users WHERE id = $1", [vendorId]);
  if (!user) {
    throw createAppError("User session no longer valid. Please sign in again.", 401);
  }

  const existing = await queryOne("SELECT id FROM stores WHERE vendor_id = $1", [vendorId]);
  if (existing) {
    throw createAppError("Vendor already has an active store", 400);
  }

  const storeId = crypto.randomUUID();
  try {
    return await queryOne(
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
  } catch (err: any) {
    if (err.code === "23503") {
      throw createAppError("User session no longer valid. Please sign in again.", 401);
    }
    throw err;
  }
}

export async function updateStore(vendorId: string, input: UpdateStoreInput) {
  const store = await getOrCreateStore(vendorId);
  return await queryOne(
    `UPDATE stores SET
       name = COALESCE($2, name),
       description = CASE WHEN $3::text IS NOT NULL THEN $3 ELSE description END,
       address = COALESCE($4, address),
       latitude = CASE WHEN $5::double precision IS NOT NULL THEN $5 ELSE latitude END,
       longitude = CASE WHEN $6::double precision IS NOT NULL THEN $6 ELSE longitude END,
       updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      store.id,
      input.name ?? null,
      input.description ?? null,
      input.address ?? null,
      input.latitude ?? null,
      input.longitude ?? null,
    ]
  );
}

export async function getStore(vendorId: string) {
  return await queryOne("SELECT * FROM stores WHERE vendor_id = $1", [vendorId]);
}

export async function createProduct(vendorId: string, input: CreateProductInput) {
  const store = await getOrCreateStore(vendorId);
  const sellingPrice = input.currentSellingPrice ?? input.price ?? 0;
  const mrp = input.mrp ?? sellingPrice;

  const sizeList: Array<{ size: string; stock: number }> =
    input.sizes && input.sizes.length > 0
      ? input.sizes
      : [{ size: input.size || "Free Size", stock: input.stock ?? 0 }];

  const createdList: any[] = [];

  for (const item of sizeList) {
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
        item.size.trim(),
        input.color,
        item.stock,
        input.imageUrl ?? null,
        store.id,
      ]
    );

    createdList.push(product);

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
  }

  return createdList.length === 1 ? createdList[0] : createdList;
}

export async function getStoreProducts(vendorId: string) {
  const store = await getOrCreateStore(vendorId);
  return await query(
    "SELECT * FROM products WHERE store_id = $1 ORDER BY created_at DESC",
    [store.id]
  );
}

export async function getProductDetail(vendorId: string, productId: string) {
  const store = await queryOne("SELECT id FROM stores WHERE vendor_id = $1", [vendorId]);
  const product = await queryOne("SELECT * FROM products WHERE id = $1", [productId]);

  if (!product) throw createAppError("Product not found", 404);
  if (!store || product.storeId !== store.id) {
    throw createAppError("Forbidden: Product does not belong to your store", 403);
  }

  return product;
}

export async function updateProduct(vendorId: string, productId: string, input: UpdateProductInput) {
  const store = await queryOne("SELECT id FROM stores WHERE vendor_id = $1", [vendorId]);
  const product = await queryOne("SELECT * FROM products WHERE id = $1", [productId]);

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
      productId,
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

  return updated;
}

export async function deleteProduct(vendorId: string, productId: string) {
  const store = await queryOne("SELECT id FROM stores WHERE vendor_id = $1", [vendorId]);
  const product = await queryOne("SELECT * FROM products WHERE id = $1", [productId]);

  if (!product) throw createAppError("Product not found", 404);
  if (!store || product.storeId !== store.id) {
    throw createAppError("Forbidden: Product does not belong to your store", 403);
  }

  await query("DELETE FROM order_items WHERE product_id = $1", [productId]);
  await query("DELETE FROM products WHERE id = $1", [productId]);

  try {
    await redis.publish(
      STOCK_UPDATES_CHANNEL,
      JSON.stringify({
        type: "product_deleted",
        productId,
        timestamp: new Date().toISOString(),
      })
    );
  } catch (err) {
    console.error("Redis publish error:", err);
  }
}

export async function getStoreOrders(vendorId: string) {
  const store = await getOrCreateStore(vendorId);
  return await query(
    `SELECT o.*,
       COALESCE((SELECT json_agg(row_to_json(oi.*)) FROM order_items oi WHERE oi.order_id = o.id), '[]'::json) AS items,
       CASE WHEN c.id IS NULL THEN NULL ELSE json_build_object('id', c.id, 'name', c.name, 'email', c.email, 'phone', c.phone, 'role', c.role) END AS customer
     FROM orders o
     LEFT JOIN users c ON o.customer_id = c.id
     WHERE o.store_id = $1
     ORDER BY o.created_at DESC`,
    [store.id]
  );
}

