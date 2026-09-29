import { db } from "../config";
import { createAppError } from "../middlewares/errorHandler";
import type { DeliveryInfoInput, UpdateDeliveryInfoInput } from "../utils/validators";

export const deliveryInfoService = {
  /**
   * Get all saved delivery profiles for a user.
   */
  async getUserDeliveryInfos(userId: string) {
    const list = await db.orm.public.DeliveryInfo.where((d) => d.userId.eq(userId))
      .orderBy((d) => d.createdAt.desc())
      .all();

    // Sort default first
    return list.sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0));
  },

  /**
   * Save a new delivery profile for a user.
   */
  async createDeliveryInfo(userId: string, input: DeliveryInfoInput) {
    // If this is set as default or the user's first address, mark isDefault true
    const existing = await db.orm.public.DeliveryInfo.where((d) => d.userId.eq(userId)).all();
    const shouldBeDefault = input.isDefault || existing.length === 0;

    if (shouldBeDefault && existing.length > 0) {
      // Unset previous defaults
      for (const item of existing) {
        if (item.isDefault) {
          await db.orm.public.DeliveryInfo.where((d) => d.id.eq(item.id)).update({
            isDefault: false,
          });
        }
      }
    }

    const created = await db.orm.public.DeliveryInfo.create({
      userId,
      label: input.label || "Home",
      name: input.name,
      phone: input.phone,
      email: input.email,
      address: input.address,
      city: input.city ?? null,
      state: input.state ?? null,
      pincode: input.pincode ?? null,
      isDefault: shouldBeDefault,
    });

    return created;
  },

  /**
   * Update an existing delivery profile with ownership check.
   */
  async updateDeliveryInfo(userId: string, id: string, input: UpdateDeliveryInfoInput) {
    const address = await db.orm.public.DeliveryInfo.where((d) => d.id.eq(id)).first();

    if (!address) {
      throw createAppError("Delivery info not found", 404);
    }

    if (address.userId !== userId) {
      throw createAppError("Forbidden: You cannot modify this address", 403);
    }

    if (input.isDefault) {
      // Unset other defaults
      const existing = await db.orm.public.DeliveryInfo.where((d) => d.userId.eq(userId)).all();
      for (const item of existing) {
        if (item.id !== id && item.isDefault) {
          await db.orm.public.DeliveryInfo.where((d) => d.id.eq(item.id)).update({
            isDefault: false,
          });
        }
      }
    }

    const updated = await db.orm.public.DeliveryInfo.where((d) => d.id.eq(id)).update({
      ...(input.label !== undefined && { label: input.label }),
      ...(input.name !== undefined && { name: input.name }),
      ...(input.phone !== undefined && { phone: input.phone }),
      ...(input.email !== undefined && { email: input.email }),
      ...(input.address !== undefined && { address: input.address }),
      ...(input.city !== undefined && { city: input.city ?? null }),
      ...(input.state !== undefined && { state: input.state ?? null }),
      ...(input.pincode !== undefined && { pincode: input.pincode ?? null }),
      ...(input.isDefault !== undefined && { isDefault: input.isDefault }),
    });

    return updated;
  },

  /**
   * Delete a saved delivery profile with ownership check.
   */
  async deleteDeliveryInfo(userId: string, id: string) {
    const address = await db.orm.public.DeliveryInfo.where((d) => d.id.eq(id)).first();

    if (!address) {
      throw createAppError("Delivery info not found", 404);
    }

    if (address.userId !== userId) {
      throw createAppError("Forbidden: You cannot delete this address", 403);
    }

    await db.orm.public.DeliveryInfo.where((d) => d.id.eq(id)).delete();

    // If deleted address was default, promote another address if one exists
    if (address.isDefault) {
      const remaining = await db.orm.public.DeliveryInfo.where((d) => d.userId.eq(userId)).first();
      if (remaining) {
        await db.orm.public.DeliveryInfo.where((d) => d.id.eq(remaining.id)).update({
          isDefault: true,
        });
      }
    }

    return { message: "Delivery info removed successfully" };
  },

  /**
   * Set a specific address as default for the user.
   */
  async setDefault(userId: string, id: string) {
    const target = await db.orm.public.DeliveryInfo.where((d) => d.id.eq(id)).first();

    if (!target) {
      throw createAppError("Delivery info not found", 404);
    }

    if (target.userId !== userId) {
      throw createAppError("Forbidden: You cannot modify this address", 403);
    }

    const all = await db.orm.public.DeliveryInfo.where((d) => d.userId.eq(userId)).all();
    for (const item of all) {
      await db.orm.public.DeliveryInfo.where((d) => d.id.eq(item.id)).update({
        isDefault: item.id === id,
      });
    }

    return { ...target, isDefault: true };
  },
};
