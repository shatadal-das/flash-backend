import { db } from "../config";
import { createAppError } from "../middlewares/errorHandler";

export const deliveryService = {
  /**
   * List available orders that are PACKED and waiting for a delivery partner.
   */
  async getAvailableOrders() {
    const orders = await db.orm.public.Order.where((o) =>
      o.status.eq("PACKED")
    )
      .include("store")
      .include("customer")
      .include("items")
      .all();

    // Filter to only unassigned orders
    return orders.filter((o) => o.deliveryPartnerId === null);
  },

  /**
   * Delivery partner accepts a PACKED order.
   * Uses a Prisma transaction to atomically verify status and absence of another driver,
   * then updates status to PICKED_UP and assigns deliveryPartnerId.
   */
  async acceptOrder(deliveryPartnerId: string, orderId: string) {
    return await (db as any).transaction(async (tx: any) => {
      const order = await tx.orm.public.Order.where((o: any) =>
        o.id.eq(orderId)
      ).first();

      if (!order) {
        throw createAppError("Order not found", 404);
      }

      if (order.status !== "PACKED") {
        throw createAppError(
          `Order is not available for pickup (current status: "${order.status}")`,
          400
        );
      }

      if (order.deliveryPartnerId !== null) {
        throw createAppError(
          "Order has already been accepted by another delivery partner",
          409
        );
      }

      const updated = await tx.orm.public.Order.where((o: any) =>
        o.id.eq(orderId)
      ).update({
        deliveryPartnerId,
        status: "PICKED_UP",
      });

      if (!updated) {
        throw createAppError("Failed to accept order", 500);
      }

      return updated;
    });
  },

  /**
   * Delivery partner marks order as DELIVERED upon completion.
   */
  async completeDelivery(deliveryPartnerId: string, orderId: string) {
    const order = await db.orm.public.Order.where((o) =>
      o.id.eq(orderId)
    ).first();

    if (!order) {
      throw createAppError("Order not found", 404);
    }

    if (order.deliveryPartnerId !== deliveryPartnerId) {
      throw createAppError(
        "Forbidden: You are not the assigned delivery partner for this order",
        403
      );
    }

    if (order.status !== "PICKED_UP") {
      throw createAppError(
        `Cannot complete delivery: order is in "${order.status}" status, not "PICKED_UP"`,
        400
      );
    }

    const updated = await db.orm.public.Order.where((o) =>
      o.id.eq(orderId)
    ).update({
      status: "DELIVERED",
    });

    if (!updated) {
      throw createAppError("Failed to complete delivery", 500);
    }

    return updated;
  },

  /**
   * Get all orders assigned to the authenticated delivery partner.
   */
  async getMyDeliveries(deliveryPartnerId: string) {
    const orders = await db.orm.public.Order.where((o) =>
      o.deliveryPartnerId.eq(deliveryPartnerId)
    )
      .include("store")
      .include("customer")
      .include("items")
      .all();

    return orders;
  },
};
