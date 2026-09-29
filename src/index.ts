import express, { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env";
import { connectDatabase, disconnectDatabase } from "./config/database";
import { disconnectRedis } from "./config/redis";
import { initRedisSub, disconnectRedisSub } from "./config/redisSub";
import { errorHandler, rateLimiter } from "./middlewares";
import routes from "./routes";

const app = express();

// Trust reverse proxy (Nginx, AWS ALB, Cloudflare, Traefik)
app.set("trust proxy", 1);

// ─── Security Headers (Helmet) ───────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false, // API server does not render HTML
    crossOriginEmbedderPolicy: false,
  })
);

// ─── Global CORS Middleware ──────────────────────────────
const defaultOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
];

const allowedOrigins = Array.from(
  new Set([
    ...defaultOrigins,
    ...(env.CLIENT_URL ? [env.CLIENT_URL] : []),
    ...env.ALLOWED_ORIGINS,
  ])
);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
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

// Rate limiting: 100 requests per minute per IP
app.use(rateLimiter({ maxRequests: 100, windowSeconds: 60 }));

// ─── Routes ──────────────────────────────────────────────
app.get("/", (_req: Request, res: Response) => {
  res.json({
    name: "Flash API",
    version: "1.0.0",
    description: "Quick-commerce fashion delivery backend",
  });
});

app.use("/api", routes);

// ─── Global Error Handler (must be last) ─────────────────
app.use(errorHandler);

// ─── Server Startup ──────────────────────────────────────
async function bootstrap(): Promise<void> {
  await connectDatabase();
  await initRedisSub();

  const server = app.listen(env.PORT, () => {
    console.log(`🚀 Flash API running on http://localhost:${env.PORT}`);
    console.log(`📦 Environment: ${env.NODE_ENV}`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    server.close(async () => {
      await disconnectRedisSub();
      await disconnectRedis();
      await disconnectDatabase();
      console.log("👋 Server shut down cleanly");
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("unhandledRejection", (reason) => {
    console.error("Unhandled Rejection:", reason);
  });
  process.on("uncaughtException", (error) => {
    console.error("Uncaught Exception:", error);
    process.exit(1);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to bootstrap:", error);
  process.exit(1);
});

export default app;
