import { redis } from "../config";

/**
 * Redis caching utility for get/set/invalidate with TTL support.
 */
export const cacheService = {
  /**
   * Get a cached value by key. Returns parsed JSON or null.
   */
  async get<T>(key: string): Promise<T | null> {
    const data = await redis.get(key);
    if (!data) return null;
    try {
      return JSON.parse(data) as T;
    } catch {
      return data as unknown as T;
    }
  },

  /**
   * Set a cached value with optional TTL (seconds). Default: 300s (5 min).
   */
  async set(key: string, value: unknown, ttlSeconds: number = 300): Promise<void> {
    const serialized = typeof value === "string" ? value : JSON.stringify(value);
    await redis.set(key, serialized, "EX", ttlSeconds);
  },

  /**
   * Delete a cached key.
   */
  async del(key: string): Promise<void> {
    await redis.del(key);
  },

  /**
   * Delete all keys matching a glob pattern.
   */
  async invalidatePattern(pattern: string): Promise<void> {
    let cursor = "0";
    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        100
      );
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== "0");
  },
};

/**
 * Sliding-window rate limiter backed by Redis.
 * Returns { allowed, remaining, retryAfterSeconds }.
 */
export async function checkRateLimit(
  identifier: string,
  maxRequests: number = 100,
  windowSeconds: number = 60
): Promise<{ allowed: boolean; remaining: number; retryAfterSeconds: number }> {
  const key = `ratelimit:${identifier}`;
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;

  const pipeline = redis.pipeline();
  // Remove expired entries
  pipeline.zremrangebyscore(key, 0, windowStart);
  // Add current request
  pipeline.zadd(key, now.toString(), `${now}:${Math.random()}`);
  // Count requests in window
  pipeline.zcard(key);
  // Set expiry on the key
  pipeline.expire(key, windowSeconds);

  const results = await pipeline.exec();
  if (!results) {
    return { allowed: true, remaining: maxRequests, retryAfterSeconds: 0 };
  }

  const requestCount = results[2]?.[1] as number;
  const allowed = requestCount <= maxRequests;
  const remaining = Math.max(0, maxRequests - requestCount);

  let retryAfterSeconds = 0;
  if (!allowed) {
    // Find the oldest entry to determine when the window resets
    const oldest = await redis.zrange(key, "0", "0", "WITHSCORES");
    if (oldest.length >= 2) {
      const oldestTimestamp = parseInt(oldest[1], 10);
      retryAfterSeconds = Math.ceil(
        (oldestTimestamp + windowSeconds * 1000 - now) / 1000
      );
    }
  }

  return { allowed, remaining, retryAfterSeconds };
}
