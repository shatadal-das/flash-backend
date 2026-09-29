import { db } from "../config";

export const adminService = {
  /**
   * Retrieve high-level business analytics using Prisma aggregate and groupBy.
   * Returns:
   * - Total sales volume
   * - Counts of active orders by status
   * - Total active stores
   * - Breakdown of products and user roles
   */
  async getDashboard() {
    // 1. Total active stores count
    const storeStats = await db.orm.public.Store.aggregate((agg: any) => ({
      totalStores: agg.count(),
    }));

    // 2. Total sales volume and total orders count
    const salesStats = await db.orm.public.Order.aggregate((agg: any) => ({
      totalOrders: agg.count(),
      totalSalesVolume: agg.sum("totalAmount"),
    }));

    // 3. Counts of orders grouped by status
    const ordersByStatusGroup = await db.orm.public.Order.groupBy(
      "status"
    ).aggregate((agg: any) => ({
      count: agg.count(),
    }));

    const statusCounts: Record<string, number> = {
      PENDING: 0,
      ACCEPTED_BY_VENDOR: 0,
      PACKED: 0,
      PICKED_UP: 0,
      DELIVERED: 0,
    };

    for (const group of ordersByStatusGroup) {
      if (group.status) {
        statusCounts[group.status] = Number(group.count) || 0;
      }
    }

    // 4. Products and users summary
    const productStats = await db.orm.public.Product.aggregate((agg: any) => ({
      totalProducts: agg.count(),
      totalStockUnits: agg.sum("stock"),
    }));

    const userStats = await db.orm.public.User.groupBy("role").aggregate(
      (agg: any) => ({
        count: agg.count(),
      })
    );

    // 5. All live orders in the system with relations
    const allOrders = await db.orm.public.Order.include("store")
      .include("customer")
      .include("deliveryPartner")
      .orderBy((o: any) => o.createdAt.desc())
      .all();

    return {
      totalActiveStores: storeStats.totalStores ?? 0,
      totalSalesVolume: salesStats.totalSalesVolume ?? 0,
      totalOrders: salesStats.totalOrders ?? 0,
      ordersByStatus: statusCounts,
      productsSummary: {
        totalProducts: productStats.totalProducts ?? 0,
        totalStockUnits: productStats.totalStockUnits ?? 0,
      },
      usersByRole: userStats,
      orders: allOrders,
    };
  },
};
