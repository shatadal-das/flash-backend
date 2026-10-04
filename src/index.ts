import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";

import { initDb, closeDb } from "./db";
import { initRedis, closeRedis, rateLimiter } from "./redis";

import authRoutes from "./routes/auth";
import productRoutes from "./routes/products";
import orderRoutes from "./routes/orders";
import vendorRoutes from "./routes/vendor";
import deliveryRoutes from "./routes/delivery";
import couponRoutes from "./routes/coupons";
import deliveryInfoRoutes from "./routes/deliveryInfo";
import adminRoutes from "./routes/admin";
import healthRoutes from "./routes/health";

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

app.set("trust proxy", 1);
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

const defaultOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
];
const allowedOrigins = Array.from(
  new Set([
    ...defaultOrigins,
    ...(process.env.CLIENT_URL ? [process.env.CLIENT_URL] : []),
    ...(process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)
      : []),
  ])
);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
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

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const statusCode = err.statusCode || 500;
  const isOperational = err.isOperational ?? false;

  if (statusCode >= 500) {
    console.error(`[ERROR] ${statusCode} - ${err.message}`, err.stack);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      message: isOperational ? err.message : "Internal Server Error",
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    },
  });
});

async function start() {
  await initDb();
  await initRedis();

  const server = app.listen(PORT, () => {
    console.log(`Flash API running on http://localhost:${PORT}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received. Shutting down...`);
    server.close(async () => {
      await closeRedis();
      await closeDb();
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

export default app;
