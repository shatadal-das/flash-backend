import { db, redis, STOCK_UPDATES_CHANNEL } from "../config";
import { createAppError } from "../middlewares/errorHandler";
import type {
  CreateStoreInput,
  CreateProductInput,
  UpdateProductInput,
} from "../utils/validators";

export const vendorService = {
  /**
   * Create a store for the authenticated vendor if they don't have one yet.
   */
  async createStore(vendorId: string, input: CreateStoreInput) {
    const existingStore = await db.orm.public.Store.where((s) =>
      s.vendorId.eq(vendorId)
    ).first();

    if (existingStore) {
      throw createAppError("Vendor already has an active store", 400);
    }

    const store = await db.orm.public.Store.create({
      name: input.name,
      description: input.description ?? null,
      address: input.address,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      vendorId,
    });

    return store;
  },

  /**
   * Get store belonging to the authenticated vendor.
   */
  async getStore(vendorId: string, throwIfNotFound = true): Promise<any> {
    const store = await db.orm.public.Store.where((s) =>
      s.vendorId.eq(vendorId)
    ).first();

    if (!store) {
      if (throwIfNotFound) {
        throw createAppError("Vendor does not have a registered store", 404);
      }
      return null;
    }

    return store;
  },

  /**
   * Get store or auto-provision a default store for the authenticated vendor.
   */
  async getOrCreateStore(vendorId: string): Promise<any> {
    let store = await db.orm.public.Store.where((s) =>
      s.vendorId.eq(vendorId)
    ).first();

    if (!store) {
      store = await this.createStore(vendorId, {
        name: "Flash Boutique Store",
        description: "Curated fashion boutique",
        address: "123 Fashion Street",
      });
    }

    return store;
  },

  /**
   * Add a product to the vendor's store.
   */
  async createProduct(vendorId: string, input: CreateProductInput) {
    const store = await this.getOrCreateStore(vendorId);

    const sellingPrice = input.currentSellingPrice ?? input.price ?? 0;
    const mrp = input.mrp ?? sellingPrice;

    const product = await db.orm.public.Product.create({
      name: input.name,
      description: input.description ?? null,
      price: sellingPrice,
      mrp: mrp,
      currentSellingPrice: sellingPrice,
      size: input.size,
      color: input.color,
      stock: input.stock,
      imageUrl: input.imageUrl ?? null,
      storeId: store.id,
    });

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
      console.error("Failed to publish product_added to Redis:", err);
    }

    return product;
  },

  /**
   * List all products belonging to the vendor's store.
   */
  async getProducts(vendorId: string) {
    const store = await this.getOrCreateStore(vendorId);

    const products = await db.orm.public.Product.where((p) =>
      p.storeId.eq(store.id)
    ).all();

    return products;
  },

  /**
   * Get single product with store ownership verification.
   */
  async getProductById(vendorId: string, productId: string) {
    const store = await this.getStore(vendorId);

    const product = await db.orm.public.Product.where((p) =>
      p.id.eq(productId)
    ).first();

    if (!product) {
      throw createAppError("Product not found", 404);
    }

    if (product.storeId !== store.id) {
      throw createAppError("Forbidden: Product does not belong to your store", 403);
    }

    return product;
  },

  /**
   * Update product with store ownership verification.
   */
  async updateProduct(
    vendorId: string,
    productId: string,
    input: UpdateProductInput
  ) {
    await this.getProductById(vendorId, productId);

    const sellingPrice = input.currentSellingPrice ?? input.price;

    const updated = await db.orm.public.Product.where((p) =>
      p.id.eq(productId)
    ).update({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && {
        description: input.description ?? null,
      }),
      ...(sellingPrice !== undefined && {
        price: sellingPrice,
        currentSellingPrice: sellingPrice,
      }),
      ...(input.mrp !== undefined && { mrp: input.mrp }),
      ...(input.size !== undefined && { size: input.size }),
      ...(input.color !== undefined && { color: input.color }),
      ...(input.stock !== undefined && { stock: input.stock }),
      ...(input.imageUrl !== undefined && { imageUrl: input.imageUrl ?? null }),
    });

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
      console.error("Failed to publish product_updated to Redis:", err);
    }

    return updated;
  },

  /**
   * Delete product with store ownership verification.
   */
  async deleteProduct(vendorId: string, productId: string) {
    await this.getProductById(vendorId, productId);

    await db.orm.public.Product.where((p) => p.id.eq(productId)).delete();

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
      console.error("Failed to publish product_deleted to Redis:", err);
    }

    return { message: "Product deleted successfully" };
  },

  /**
   * Get all orders placed with the vendor's store.
   */
  async getStoreOrders(vendorId: string) {
    const store = await this.getOrCreateStore(vendorId);

    const orders = await db.orm.public.Order.where((o) =>
      o.storeId.eq(store.id)
    )
      .include("items")
      .include("customer")
      .orderBy((o) => o.createdAt.desc())
      .all();

    return orders;
  },
};
