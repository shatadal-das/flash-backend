import { db, redis, STOCK_UPDATES_CHANNEL } from "../config";
import { createAppError } from "../middlewares/errorHandler";
import type { CreateOrderInput } from "../utils/validators";

export const orderService = {
  /**
   * Create an order using a Prisma interactive transaction.
   * Atomically validates stock, decrements inventory, and creates Order + OrderItems.
   * Rolls back if any product has insufficient stock.
   */
  async createOrder(customerId: string, input: CreateOrderInput) {
    let itemsUpdated: Array<{ productId: string; newStock: number }> = [];

    const result = await (db as any).transaction(async (tx: any) => {
      // 1. Fetch all products and validate existence + stock
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
        const product = await tx.orm.public.Product.where((p: any) =>
          p.id.eq(item.productId)
        ).first();

        if (!product) {
          throw createAppError(`Product with ID "${item.productId}" not found`, 404);
        }

        // Check store consistency: all items in a delivery must come from the same store
        if (commonStoreId === null) {
          commonStoreId = product.storeId;
        } else if (commonStoreId !== product.storeId) {
          throw createAppError(
            "All items in an order must be from the same store for point-to-point delivery",
            400
          );
        }

        // Check sufficient stock
        if (product.stock < item.quantity) {
          throw createAppError(
            `Insufficient stock for "${product.name}". Available: ${product.stock}, requested: ${item.quantity}`,
            400
          );
        }

        const itemTotal = product.price * item.quantity;
        totalAmount += itemTotal;

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

      // 2. Decrement stock for each product
      for (const item of itemsToProcess) {
        const newStock = item.currentStock - item.quantity;
        await tx.orm.public.Product.where((p: any) =>
          p.id.eq(item.productId)
        ).update({
          stock: newStock,
        });
        itemsUpdated.push({ productId: item.productId, newStock });
      }

      // 3. Process Coupon Code if provided
      let couponId: string | null = null;
      let couponDiscount = 0;

      if (input.couponCode) {
        const code = input.couponCode.toUpperCase().trim();
        const coupon = await tx.orm.public.Coupon.where((c: any) =>
          c.code.eq(code)
        ).first();

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

        // Increment usage count atomically inside transaction
        await tx.orm.public.Coupon.where((c: any) => c.id.eq(coupon.id)).update({
          usedCount: coupon.usedCount + 1,
        });
      }

      const finalAmount = Math.max(0, Math.round((totalAmount - couponDiscount) * 100) / 100);

      // 4. Create the Order in PENDING status
      const order = await tx.orm.public.Order.create({
        customerId,
        storeId: commonStoreId!,
        totalAmount: finalAmount,
        status: "PENDING",
        deliveryAddress: input.deliveryAddress,
        deliveryPhone: input.deliveryPhone ?? null,
        deliveryEmail: input.deliveryEmail ?? null,
        deliveryLatitude: input.deliveryLatitude ?? null,
        deliveryLongitude: input.deliveryLongitude ?? null,
        couponId: couponId ?? null,
        couponDiscount: couponDiscount,
      });

      // 5. Create OrderItem records
      const createdItems = [];
      for (const item of itemsToProcess) {
        const orderItem = await tx.orm.public.OrderItem.create({
          orderId: order.id,
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
          size: item.size,
          color: item.color,
        });
        createdItems.push(orderItem);
      }

      return {
        ...order,
        items: createdItems,
      };
    });

    // Broadcast live stock updates to connected customers and vendors
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
      console.error("Failed to publish real-time stock update to Redis:", err);
    }

    return result;
  },

  /**
   * Get all orders for the authenticated customer.
   */
  async getCustomerOrders(customerId: string) {
    const orders = await db.orm.public.Order.where((o) =>
      o.customerId.eq(customerId)
    )
      .include("items")
      .include("store")
      .include("coupon")
      .orderBy((o) => o.createdAt.desc())
      .all();

    return orders;
  },

  /**
   * Get single order by ID for the authenticated customer.
   */
  async getOrderById(customerId: string, orderId: string) {
    const order = await db.orm.public.Order.where((o) =>
      o.id.eq(orderId)
    )
      .include("items")
      .include("store")
      .include("coupon")
      .first();

    if (!order) {
      throw createAppError("Order not found", 404);
    }

    if (order.customerId !== customerId) {
      throw createAppError("Forbidden: You cannot view this order", 403);
    }

    return order;
  },
};
