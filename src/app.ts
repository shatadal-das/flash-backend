import express, { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config/env";
import { rateLimiter } from "./middleware/rate-limiter";
import { errorHandler } from "./middleware/error";

import authRoutes from "./modules/auth/auth.routes";
import productRoutes from "./modules/products/product.routes";
import orderRoutes from "./modules/orders/order.routes";
import vendorRoutes from "./modules/vendor/vendor.routes";
import deliveryRoutes from "./modules/delivery/delivery.routes";
import couponRoutes from "./modules/coupons/coupon.routes";
import deliveryInfoRoutes from "./modules/delivery-info/delivery-info.routes";
import adminRoutes from "./modules/admin/admin.routes";
import healthRoutes from "./modules/health/health.routes";

export const app = express();

app.set("trust proxy", 1);
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || config.allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(rateLimiter({ maxRequests: 100, windowSeconds: 60 }));

app.get("/", (_req: Request, res: Response) => {
  res.json({
    name: "Flash API",
    version: "1.0.0",
    description: "Quick-commerce fashion delivery backend",
  });
});

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/vendor", vendorRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/delivery", deliveryRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/products", productRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/delivery-info", deliveryInfoRoutes);

app.use(errorHandler);

