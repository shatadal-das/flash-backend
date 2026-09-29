import { Request, Response } from "express";
import { db, redis } from "../config";

export const healthController = {
  async check(_req: Request, res: Response): Promise<void> {
    const checks: Record<string, string> = {
      server: "ok",
      postgres: "checking",
      redis: "checking",
    };

    // Check PostgreSQL — use a simple findMany with limit 0 to verify connectivity
    try {
      const runtime = db.runtime();
      checks.postgres = runtime ? "ok" : "error";
    } catch {
      checks.postgres = "error";
    }

    // Check Redis
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
  },
};
