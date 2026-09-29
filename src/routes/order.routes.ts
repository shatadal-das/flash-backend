import { Router } from "express";
import { orderController } from "../controllers/order.controller";
import { logisticsController } from "../controllers/logistics.controller";
import { asyncHandler } from "../middlewares/asyncHandler";
import { verifyToken, requireRole } from "../middlewares/auth";
import { validateBody } from "../middlewares/validate";
import { createOrderSchema } from "../utils/validators";

const router = Router();

// All order endpoints require authentication
router.use(verifyToken);

// ─── Vendor Logistics Route: Pack Order ───────────────────
// PUT /api/orders/:id/pack
router.put(
  "/:id/pack",
  requireRole(["VENDOR"]),
  asyncHandler(logisticsController.packOrder)
);

// ─── Customer Order Engine Routes ─────────────────────────
// POST /api/orders
router.post(
  "/",
  requireRole(["CUSTOMER"]),
  validateBody(createOrderSchema),
  asyncHandler(orderController.createOrder)
);

// GET /api/orders
router.get(
  "/",
  requireRole(["CUSTOMER"]),
  asyncHandler(orderController.getCustomerOrders)
);

// GET /api/orders/:id
router.get(
  "/:id",
  requireRole(["CUSTOMER"]),
  asyncHandler(orderController.getOrderById)
);

export default router;
