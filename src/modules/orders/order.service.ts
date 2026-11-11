import crypto from "crypto";
import { query, queryOne, getClient, toCamel } from "../../database/query";
import { redis } from "../../events/redis";
import { DELIVERY_ALERTS_CHANNEL, STOCK_UPDATES_CHANNEL } from "../../events/channels";
import { createAppError } from "../../middleware/error";
import { CreateOrderInput } from "./order.types";

export async function packOrder(vendorId: string, orderId: string) {
  const store = await queryOne("SELECT * FROM stores WHERE vendor_id = $1", [vendorId]);
  if (!store) {
    throw createAppError("Vendor does not have a registered store", 403);
  }

  const order = await queryOne(
    `SELECT o.*,
       COALESCE((SELECT json_agg(row_to_json(oi.*)) FROM order_items oi WHERE oi.order_id = o.id), '[]'::json) AS items
     FROM orders o
     WHERE o.id = $1`,
    [orderId]
  );

  if (!order) throw createAppError("Order not found", 404);
  if (order.storeId !== store.id) {
    throw createAppError("Forbidden: Order does not belong to your store", 403);
  }

  if (order.status === "PICKED_UP" || order.status === "DELIVERED") {
    throw createAppError(`Cannot pack order: already in "${order.status}" status`, 400);
  }

  const updated = await queryOne(
    "UPDATE orders SET status = 'PACKED', updated_at = NOW() WHERE id = $1 RETURNING *",
    [orderId]
  );

  try {
    await redis.publish(
      DELIVERY_ALERTS_CHANNEL,
      JSON.stringify({
        orderId: updated!.id,
        storeId: updated!.storeId,
        storeName: store.name,
        storeAddress: store.address,
        customerId: updated!.customerId,
        totalAmount: updated!.totalAmount,
        deliveryAddress: updated!.deliveryAddress,
        status: updated!.status,
        itemsCount: order.items.length,
        packedAt: new Date().toISOString(),
      })
    );
  } catch (err) {
    console.error("Redis delivery alert publish error:", err);
  }

  return {
    ...updated,
    items: order.items,
  };
}

export async function createOrder(customerId: string, input: CreateOrderInput) {
  const itemsUpdated: Array<{ productId: string; newStock: number }> = [];
  const client = await getClient();

  try {
    await client.query("BEGIN");

    const itemsToProcess: Array<{
      productId: string;
      quantity: number;
      price: number;
      size: string;
      color: string;
      currentStock: number;
      storeId: string;
    }> = [];

    let commonStoreId: string | null = null;
    let totalAmount = 0;

    for (const item of input.items) {
      const prodRes = await client.query(
        "SELECT * FROM products WHERE id = $1 FOR UPDATE",
        [item.productId]
      );
      const product = toCamel(prodRes.rows[0]);

      if (!product) {
        throw createAppError(`Product with ID "${item.productId}" not found`, 404);
      }

      if (commonStoreId === null) {
        commonStoreId = product.storeId;
      } else if (commonStoreId !== product.storeId) {
        throw createAppError(
          "All items in an order must be from the same store for point-to-point delivery",
          400
        );
      }

      if (product.stock < item.quantity) {
        throw createAppError(
          `Insufficient stock for "${product.name}". Available: ${product.stock}, requested: ${item.quantity}`,
          400
        );
      }

      totalAmount += product.price * item.quantity;
      itemsToProcess.push({
        productId: product.id,
        quantity: item.quantity,
        price: product.price,
        size: product.size,
        color: product.color,
        currentStock: product.stock,
        storeId: product.storeId,
      });
    }

    for (const item of itemsToProcess) {
      const newStock = item.currentStock - item.quantity;
      await client.query(
        "UPDATE products SET stock = $1, updated_at = NOW() WHERE id = $2",
        [newStock, item.productId]
      );
      itemsUpdated.push({ productId: item.productId, newStock });
    }

    let couponId: string | null = null;
    let couponDiscount = 0;

    if (input.couponCode) {
      const code = input.couponCode.toUpperCase().trim();
      const couponRes = await client.query(
        "SELECT * FROM coupons WHERE code = $1 FOR UPDATE",
        [code]
      );
      const coupon = toCamel(couponRes.rows[0]);

      if (!coupon) {
        throw createAppError(`Invalid coupon code "${code}"`, 400);
      }
      if (!coupon.isActive) {
        throw createAppError(`Coupon code "${code}" is inactive`, 400);
      }
      if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now()) {
        throw createAppError(`Coupon code "${code}" has expired`, 400);
      }
      if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
        throw createAppError(`Coupon code "${code}" has reached its maximum usage limit`, 400);
      }
      if (totalAmount < coupon.minOrderAmount) {
        throw createAppError(
          `Minimum order amount of $${coupon.minOrderAmount.toFixed(2)} required for coupon "${code}"`,
          400
        );
      }

      if (coupon.discountType === "PERCENTAGE") {
        couponDiscount = totalAmount * (coupon.discountValue / 100);
        if (coupon.maxDiscount !== null && coupon.maxDiscount > 0) {
          couponDiscount = Math.min(couponDiscount, coupon.maxDiscount);
        }
      } else {
        couponDiscount = Math.min(coupon.discountValue, totalAmount);
      }

      couponDiscount = Math.round(couponDiscount * 100) / 100;
      couponId = coupon.id;

      await client.query(
        "UPDATE coupons SET used_count = used_count + 1, updated_at = NOW() WHERE id = $1",
        [coupon.id]
      );
    }

    const finalAmount = Math.max(0, Math.round((totalAmount - couponDiscount) * 100) / 100);
    const orderId = crypto.randomUUID();

    const orderRes = await client.query(
      `INSERT INTO orders (
         id, customer_id, store_id, total_amount, status,
         delivery_address, delivery_phone, delivery_email,
         delivery_latitude, delivery_longitude, coupon_id, coupon_discount
       )
       VALUES ($1, $2, $3, $4, 'PENDING', $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        orderId,
        customerId,
        commonStoreId!,
        finalAmount,
        input.deliveryAddress,
        input.deliveryPhone ?? null,
        input.deliveryEmail ?? null,
        input.deliveryLatitude ?? null,
        input.deliveryLongitude ?? null,
        couponId,
        couponDiscount,
      ]
    );
    const order = toCamel(orderRes.rows[0]);

    const createdItems = [];
    for (const item of itemsToProcess) {
      const itemId = crypto.randomUUID();
      const itemRes = await client.query(
        `INSERT INTO order_items (id, order_id, product_id, quantity, price, size, color)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          itemId,
          orderId,
          item.productId,
          item.quantity,
          item.price,
          item.size,
          item.color,
        ]
      );
      createdItems.push(toCamel(itemRes.rows[0]));
    }

    await client.query("COMMIT");

    try {
      await redis.publish(
        STOCK_UPDATES_CHANNEL,
        JSON.stringify({
          type: "stock_decremented",
          updates: itemsUpdated,
          timestamp: new Date().toISOString(),
        })
      );
    } catch (err) {
      console.error("Redis stock update publish error:", err);
    }

    return {
      ...order,
      items: createdItems,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function getCustomerOrders(customerId: string) {
  return await query(
    `SELECT o.*,
       COALESCE((SELECT json_agg(row_to_json(oi.*)) FROM order_items oi WHERE oi.order_id = o.id), '[]'::json) AS items,
       CASE WHEN s.id IS NULL THEN NULL ELSE row_to_json(s.*) END AS store,
       CASE WHEN cp.id IS NULL THEN NULL ELSE row_to_json(cp.*) END AS coupon
     FROM orders o
     LEFT JOIN stores s ON o.store_id = s.id
     LEFT JOIN coupons cp ON o.coupon_id = cp.id
     WHERE o.customer_id = $1
     ORDER BY o.created_at DESC`,
    [customerId]
  );
}

export async function getCustomerOrderById(customerId: string, orderId: string) {
  const order = await queryOne(
    `SELECT o.*,
       COALESCE((SELECT json_agg(row_to_json(oi.*)) FROM order_items oi WHERE oi.order_id = o.id), '[]'::json) AS items,
       CASE WHEN s.id IS NULL THEN NULL ELSE row_to_json(s.*) END AS store,
       CASE WHEN cp.id IS NULL THEN NULL ELSE row_to_json(cp.*) END AS coupon
     FROM orders o
     LEFT JOIN stores s ON o.store_id = s.id
     LEFT JOIN coupons cp ON o.coupon_id = cp.id
     WHERE o.id = $1`,
    [orderId]
  );

  if (!order) throw createAppError("Order not found", 404);
  if (order.customerId !== customerId) {
    throw createAppError("Forbidden: You cannot view this order", 403);
  }

  return order;
}

