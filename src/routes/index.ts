import { Router } from "express";
import healthRoutes from "./health.routes";
import authRoutes from "./auth.routes";
import vendorRoutes from "./vendor.routes";
import orderRoutes from "./order.routes";
import deliveryRoutes from "./delivery.routes";
import adminRoutes from "./admin.routes";
import productRoutes from "./product.routes";
import couponRoutes from "./coupon.routes";
import deliveryInfoRoutes from "./deliveryInfo.routes";

const router = Router();

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/vendor", vendorRoutes);
router.use("/orders", orderRoutes);
router.use("/delivery", deliveryRoutes);
router.use("/admin", adminRoutes);
router.use("/products", productRoutes);
router.use("/coupons", couponRoutes);
router.use("/delivery-info", deliveryInfoRoutes);

export default router;
