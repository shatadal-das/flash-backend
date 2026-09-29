import Redis from "ioredis";
import { env } from "./env";

export const redis = new Redis(env.REDIS_URI, {
  maxRetriesPerRequest: 3,
  retryStrategy(times: number): number | null {
    if (times > 10) {
      console.error("❌ Redis max retries reached, giving up");
      return null;
    }
    return Math.min(times * 200, 2000);
  },
});

redis.on("connect", () => {
  console.log("✅ Redis connected");
});

redis.on("error", (err: Error) => {
  console.error("❌ Redis error:", err.message);
});

export async function disconnectRedis(): Promise<void> {
  await redis.quit();
  console.log("🔌 Redis disconnected");
}
