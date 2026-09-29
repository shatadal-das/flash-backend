import { db, redis, DELIVERY_ALERTS_CHANNEL } from "../config";
import { createAppError } from "../middlewares/errorHandler";

export const logisticsService = {
  /**
   * Vendor marks an order as PACKED.
   * Publishes a delivery notification to the Redis delivery_alerts channel.
   */
  async packOrder(vendorId: string, orderId: string) {
    // 1. Verify vendor has a store
    const store = await db.orm.public.Store.where((s) =>
      s.vendorId.eq(vendorId)
    ).first();

    if (!store) {
      throw createAppError("Vendor does not have a registered store", 403);
    }

    // 2. Fetch order with items
    const order = await db.orm.public.Order.where((o) =>
      o.id.eq(orderId)
    )
      .include("items")
      .first();

    if (!order) {
      throw createAppError("Order not found", 404);
    }

    // 3. Security check: order must belong to vendor's store
    if (order.storeId !== store.id) {
      throw createAppError(
        "Forbidden: Order does not belong to your store",
        403
      );
    }

    // 4. State validation: can only pack PENDING or ACCEPTED_BY_VENDOR orders
    if (order.status === "PICKED_UP" || order.status === "DELIVERED") {
      throw createAppError(
        `Cannot pack order: already in "${order.status}" status`,
        400
      );
    }

    // 5. Update order status to PACKED
    const updated = await db.orm.public.Order.where((o) =>
      o.id.eq(orderId)
    ).update({
      status: "PACKED",
    });

    if (!updated) {
      throw createAppError("Order not found or update failed", 404);
    }

    // 6. Publish message to Redis delivery_alerts channel
    const alertPayload = {
      orderId: updated.id,
      storeId: updated.storeId,
      storeName: store.name,
      storeAddress: store.address,
      customerId: updated.customerId,
      totalAmount: updated.totalAmount,
      deliveryAddress: updated.deliveryAddress,
      status: updated.status,
      itemsCount: order.items.length,
      packedAt: new Date().toISOString(),
    };

    try {
      await redis.publish(
        DELIVERY_ALERTS_CHANNEL,
        JSON.stringify(alertPayload)
      );
    } catch (err) {
      console.error("Failed to publish delivery alert to Redis:", err);
      // Even if Redis publish fails, database update succeeded
    }

    return {
      ...updated,
      items: order.items,
    };
  },
};
