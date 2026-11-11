import { Router } from "express";
import { verifyToken, requireRole } from "../../middleware/auth";
import { validateBody } from "../../middleware/validate";
import { createOrderSchema } from "./order.types";
import {
  handlePackOrder,
  handleCreateOrder,
  handleListCustomerOrders,
  handleGetCustomerOrder,
} from "./order.controller";

const router = Router();
router.use(verifyToken);

router.put("/:id/pack", requireRole(["VENDOR"]), handlePackOrder);
router.post("/", requireRole(["CUSTOMER"]), validateBody(createOrderSchema), handleCreateOrder);
router.get("/", requireRole(["CUSTOMER"]), handleListCustomerOrders);
router.get("/:id", requireRole(["CUSTOMER"]), handleGetCustomerOrder);

export default router;

