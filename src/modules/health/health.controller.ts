import { Request, Response } from "express";
import { queryOne } from "../../database/query";
import { redis } from "../../events/redis";

export async function handleHealthCheck(_req: Request, res: Response) {
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
}

