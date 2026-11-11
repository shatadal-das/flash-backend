import Redis from "ioredis";
import { config } from "../config/env";
import { DELIVERY_ALERTS_CHANNEL, STOCK_UPDATES_CHANNEL } from "./channels";
import { stockBroadcaster } from "./broadcaster";

export const redis = new Redis(config.redisUri, {
  maxRetriesPerRequest: 3,
  retryStrategy(times: number): number | null {
    if (times > 10) return null;
    return Math.min(times * 200, 2000);
  },
});

export const redisSub = new Redis(config.redisUri, {
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
}

export async function closeRedis(): Promise<void> {
  try {
    if (redisSub.status === "ready" || redisSub.status === "connect") {
      await redisSub.unsubscribe(DELIVERY_ALERTS_CHANNEL, STOCK_UPDATES_CHANNEL);
      await redisSub.quit();
    }
    await redis.quit();
  } catch (err) {
    console.error("Error disconnecting Redis:", err);
  }
}

