import { redis } from "./redis";

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

