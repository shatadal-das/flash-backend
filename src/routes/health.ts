import { Router, Request, Response } from "express";
import { queryOne } from "../db";
import { redis } from "../redis";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  const checks: Record<string, string> = {
    server: "ok",
    postgres: "checking",
    redis: "checking",
  };

  try {
    await queryOne("SELECT 1");
    checks.postgres = "ok";
  } catch {
    checks.postgres = "error";
  }

  try {
    await redis.ping();
    checks.redis = "ok";
  } catch {
    checks.redis = "error";
  }

  const allHealthy = Object.values(checks).every((v) => v === "ok");
  const statusCode = allHealthy ? 200 : 503;

  res.status(statusCode).json({
    success: allHealthy,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks,
  });
});

export default router;
