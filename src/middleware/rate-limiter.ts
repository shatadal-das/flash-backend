import { Request, Response, NextFunction } from "express";
import { redis } from "../events/redis";

export function rateLimiter(options: { maxRequests?: number; windowSeconds?: number } = {}) {
  const { maxRequests = 100, windowSeconds = 60 } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const key = `ratelimit:${req.ip || "unknown"}`;
      const now = Date.now();
      const windowStart = now - windowSeconds * 1000;

      const pipeline = redis.pipeline();
      pipeline.zremrangebyscore(key, 0, windowStart);
      pipeline.zadd(key, now.toString(), `${now}:${Math.random()}`);
      pipeline.zcard(key);
      pipeline.expire(key, windowSeconds);

      const results = await pipeline.exec();
      if (!results) return next();

      const count = results[2]?.[1] as number;
      const allowed = count <= maxRequests;
      const remaining = Math.max(0, maxRequests - count);

      res.setHeader("X-RateLimit-Limit", maxRequests);
      res.setHeader("X-RateLimit-Remaining", remaining);

      if (!allowed) {
        const oldest = await redis.zrange(key, "0", "0", "WITHSCORES");
        const retryAfter = oldest.length >= 2
          ? Math.ceil((parseInt(oldest[1], 10) + windowSeconds * 1000 - now) / 1000)
          : windowSeconds;

        res.setHeader("Retry-After", retryAfter);
        res.status(429).json({
          success: false,
          error: {
            message: "Too many requests, please try again later.",
            retryAfterSeconds: retryAfter,
          },
        });
        return;
      }

      next();
    } catch {
      next();
    }
  };
}

