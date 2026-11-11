import { Router } from "express";
import { verifyToken, requireRole } from "../../middleware/auth";
import {
  handleListAvailableOrders,
  handleAcceptOrder,
  handleCompleteDelivery,
  handleListMyDeliveries,
} from "./delivery.controller";

const router = Router();
router.use(verifyToken, requireRole(["DELIVERY"]));

router.get("/available", handleListAvailableOrders);
router.post("/accept/:orderId", handleAcceptOrder);
router.put("/complete/:orderId", handleCompleteDelivery);
router.get("/my-orders", handleListMyDeliveries);

export default router;

