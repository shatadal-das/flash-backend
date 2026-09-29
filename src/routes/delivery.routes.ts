import { Router } from "express";
import { deliveryController } from "../controllers/delivery.controller";
import { asyncHandler } from "../middlewares/asyncHandler";
import { verifyToken, requireRole } from "../middlewares/auth";

const router = Router();

// Protect all delivery routes with DELIVERY role requirement
router.use(verifyToken, requireRole(["DELIVERY"]));

// ─── Delivery Partner Endpoints ───────────────────────────
// GET /api/delivery/available
router.get("/available", asyncHandler(deliveryController.getAvailableOrders));

// POST /api/delivery/accept/:orderId
router.post("/accept/:orderId", asyncHandler(deliveryController.acceptOrder));

// PUT /api/delivery/complete/:orderId
router.put(
  "/complete/:orderId",
  asyncHandler(deliveryController.completeDelivery)
);

// GET /api/delivery/my-orders
router.get("/my-orders", asyncHandler(deliveryController.getMyDeliveries));

export default router;
