import { Router, Request, Response } from "express";
import { query, queryOne } from "../db";
import { verifyToken, requireRole } from "../auth";

const router = Router();
router.use(verifyToken, requireRole(["ADMIN"]));

router.get("/dashboard", async (_req: Request, res: Response) => {
  const [stores, ordersAgg, statusGroups, productsAgg, roles, allOrders] = await Promise.all([
    queryOne<{ count: number }>("SELECT count(*)::int AS count FROM stores"),
    queryOne<{ count: number; sum: number }>(
      "SELECT count(*)::int AS count, COALESCE(sum(total_amount), 0)::float AS sum FROM orders"
    ),
    query<{ status: string; count: number }>(
      "SELECT status, count(*)::int AS count FROM orders GROUP BY status"
    ),
    queryOne<{ count: number; sum: number }>(
      "SELECT count(*)::int AS count, COALESCE(sum(stock), 0)::int AS sum FROM products"
    ),
    query<{ role: string; count: number }>(
      "SELECT role, count(*)::int AS count FROM users GROUP BY role"
    ),
    query(`
      SELECT o.*,
        COALESCE((SELECT json_agg(row_to_json(oi.*)) FROM order_items oi WHERE oi.order_id = o.id), '[]'::json) AS items,
        CASE WHEN s.id IS NULL THEN NULL ELSE row_to_json(s.*) END AS store,
        CASE WHEN c.id IS NULL THEN NULL ELSE json_build_object('id', c.id, 'name', c.name, 'email', c.email, 'phone', c.phone, 'role', c.role) END AS customer,
        CASE WHEN dp.id IS NULL THEN NULL ELSE json_build_object('id', dp.id, 'name', dp.name, 'email', dp.email, 'phone', dp.phone, 'role', dp.role) END AS "deliveryPartner"
      FROM orders o
      LEFT JOIN stores s ON o.store_id = s.id
      LEFT JOIN users c ON o.customer_id = c.id
      LEFT JOIN users dp ON o.delivery_partner_id = dp.id
      ORDER BY o.created_at DESC
    `),
  ]);

  const statusCounts: Record<string, number> = {
    PENDING: 0,
    ACCEPTED_BY_VENDOR: 0,
    PACKED: 0,
    PICKED_UP: 0,
    DELIVERED: 0,
  };

  for (const group of statusGroups) {
    if (group.status) {
      statusCounts[group.status] = group.count;
    }
  }

  res.status(200).json({
    success: true,
    data: {
      totalActiveStores: stores?.count ?? 0,
      totalSalesVolume: ordersAgg?.sum ?? 0,
      totalOrders: ordersAgg?.count ?? 0,
      ordersByStatus: statusCounts,
      productsSummary: {
        totalProducts: productsAgg?.count ?? 0,
        totalStockUnits: productsAgg?.sum ?? 0,
      },
      usersByRole: roles,
      orders: allOrders,
    },
  });
});

export default router;
