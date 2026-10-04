import Redis from "ioredis";
import { EventEmitter } from "events";
import { Request, Response, NextFunction } from "express";

const REDIS_URI = process.env.REDIS_URI || "redis://localhost:6379";

export const DELIVERY_ALERTS_CHANNEL = "delivery_alerts";
export const STOCK_UPDATES_CHANNEL = "stock_updates";

export const stockBroadcaster = new EventEmitter();
stockBroadcaster.setMaxListeners(0);

export const redis = new Redis(REDIS_URI, {
  maxRetriesPerRequest: 3,
  retryStrategy(times: number): number | null {
    if (times > 10) return null;
    return Math.min(times * 200, 2000);
  },
});

export const redisSub = new Redis(REDIS_URI, {
  maxRetriesPerRequest: 3,
  retryStrategy(times: number): number | null {
    if (times > 10) return null;
    return Math.min(times * 200, 2000);
  },
});

redis.on("error", (err) => console.error("Redis error:", err.message));
redisSub.on("error", (err) => console.error("Redis Sub error:", err.message));

export async function initRedis(): Promise<void> {
  await redisSub.subscribe(DELIVERY_ALERTS_CHANNEL, STOCK_UPDATES_CHANNEL);
  redisSub.on("message", (channel, message) => {
    if (channel === STOCK_UPDATES_CHANNEL) {
      stockBroadcaster.emit("stock", message);
    }
  });
  console.log("Redis connected & subscribed");
}

export async function closeRedis(): Promise<void> {
  try {
    if (redisSub.status === "ready" || redisSub.status === "connect") {
      await redisSub.unsubscribe(DELIVERY_ALERTS_CHANNEL, STOCK_UPDATES_CHANNEL);
      await redisSub.quit();
    }
    await redis.quit();
    console.log("Redis disconnected");
  } catch (err) {
    console.error("Error disconnecting Redis:", err);
  }
}

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    const data = await redis.get(key);
    if (!data) return null;
    try {
      return JSON.parse(data) as T;
    } catch {
      return data as unknown as T;
    }
  },

  async set(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
    const serialized = typeof value === "string" ? value : JSON.stringify(value);
    await redis.set(key, serialized, "EX", ttlSeconds);
  },

  async del(key: string): Promise<void> {
    await redis.del(key);
  },
};

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
      next(); // allow on redis failure
    }
  };
}
