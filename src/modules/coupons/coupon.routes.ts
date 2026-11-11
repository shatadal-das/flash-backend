import { Router } from "express";
import { verifyToken, requireRole } from "../../middleware/auth";
import { validateBody } from "../../middleware/validate";
import { createCouponSchema, validateCouponSchema } from "./coupon.types";
import {
  handleGetCoupons,
  handleValidateCoupon,
  handleCreateCoupon,
} from "./coupon.controller";

const router = Router();

router.get("/", handleGetCoupons);
router.post("/validate", validateBody(validateCouponSchema), handleValidateCoupon);
router.post(
  "/",
  verifyToken,
  requireRole(["ADMIN", "VENDOR"]),
  validateBody(createCouponSchema),
  handleCreateCoupon
);

export default router;

