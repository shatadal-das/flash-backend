import { Router, Request, Response } from "express";
import { query, queryOne, getClient, toCamel } from "../db";
import { verifyToken, requireRole, createAppError } from "../auth";

const router = Router();
router.use(verifyToken, requireRole(["DELIVERY"]));

router.get("/available", async (_req: Request, res: Response) => {
  const orders = await query(
    `SELECT o.*,
       COALESCE((SELECT json_agg(row_to_json(oi.*)) FROM order_items oi WHERE oi.order_id = o.id), '[]'::json) AS items,
       CASE WHEN s.id IS NULL THEN NULL ELSE row_to_json(s.*) END AS store,
       CASE WHEN c.id IS NULL THEN NULL ELSE json_build_object('id', c.id, 'name', c.name, 'email', c.email, 'phone', c.phone, 'role', c.role) END AS customer
     FROM orders o
     LEFT JOIN stores s ON o.store_id = s.id
     LEFT JOIN users c ON o.customer_id = c.id
     WHERE o.status = 'PACKED' AND o.delivery_partner_id IS NULL
     ORDER BY o.created_at DESC`
  );

  res.status(200).json({ success: true, data: orders });
});

router.post("/accept/:orderId", async (req: Request, res: Response) => {
  const deliveryPartnerId = req.user!.userId;
  const orderId = req.params.orderId as string;

  const client = await getClient();
  try {
    await client.query("BEGIN");

    const orderRes = await client.query(
      "SELECT * FROM orders WHERE id = $1 FOR UPDATE",
      [orderId]
    );
    const order = toCamel(orderRes.rows[0]);

    if (!order) throw createAppError("Order not found", 404);
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

    const updateRes = await client.query(
      "UPDATE orders SET delivery_partner_id = $1, status = 'PICKED_UP', updated_at = NOW() WHERE id = $2 RETURNING *",
      [deliveryPartnerId, orderId]
    );

    await client.query("COMMIT");
    res.status(200).json({ success: true, data: toCamel(updateRes.rows[0]) });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

router.put("/complete/:orderId", async (req: Request, res: Response) => {
  const deliveryPartnerId = req.user!.userId;
  const orderId = req.params.orderId as string;

  const order = await queryOne("SELECT * FROM orders WHERE id = $1", [orderId]);
  if (!order) throw createAppError("Order not found", 404);

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

  const updated = await queryOne(
    "UPDATE orders SET status = 'DELIVERED', updated_at = NOW() WHERE id = $1 RETURNING *",
    [orderId]
  );

  res.status(200).json({ success: true, data: updated });
});

router.get("/my-orders", async (req: Request, res: Response) => {
  const orders = await query(
    `SELECT o.*,
       COALESCE((SELECT json_agg(row_to_json(oi.*)) FROM order_items oi WHERE oi.order_id = o.id), '[]'::json) AS items,
       CASE WHEN s.id IS NULL THEN NULL ELSE row_to_json(s.*) END AS store,
       CASE WHEN c.id IS NULL THEN NULL ELSE json_build_object('id', c.id, 'name', c.name, 'email', c.email, 'phone', c.phone, 'role', c.role) END AS customer
     FROM orders o
     LEFT JOIN stores s ON o.store_id = s.id
     LEFT JOIN users c ON o.customer_id = c.id
     WHERE o.delivery_partner_id = $1
     ORDER BY o.created_at DESC`,
    [req.user!.userId]
  );

  res.status(200).json({ success: true, data: orders });
});

export default router;
