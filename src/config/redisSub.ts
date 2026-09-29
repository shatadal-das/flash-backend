import Redis from "ioredis";
import { EventEmitter } from "events";
import { env } from "./env";

export const DELIVERY_ALERTS_CHANNEL = "delivery_alerts";
export const STOCK_UPDATES_CHANNEL = "stock_updates";

export const stockBroadcaster = new EventEmitter();
stockBroadcaster.setMaxListeners(0);

/**
 * Dedicated Redis subscriber connection.
 * Redis requires separate connections for pub/sub operations when in subscriber mode.
 */
export const redisSub = new Redis(env.REDIS_URI, {
  maxRetriesPerRequest: 3,
  retryStrategy(times: number): number | null {
    if (times > 10) {
      console.error("❌ Redis Sub max retries reached, giving up");
      return null;
    }
    return Math.min(times * 200, 2000);
  },
});

redisSub.on("connect", () => {
  console.log("✅ Redis Sub client connected");
});

redisSub.on("error", (err: Error) => {
  console.error("❌ Redis Sub error:", err.message);
});

export async function initRedisSub(): Promise<void> {
  await redisSub.subscribe(DELIVERY_ALERTS_CHANNEL, STOCK_UPDATES_CHANNEL);
  console.log(
    `📡 Subscribed to Redis channels: "${DELIVERY_ALERTS_CHANNEL}", "${STOCK_UPDATES_CHANNEL}"`
  );

  redisSub.on("message", (channel: string, message: string) => {
    if (channel === DELIVERY_ALERTS_CHANNEL) {
      try {
        const parsed = JSON.parse(message);
        console.log(`🚚 [DELIVERY_ALERT] New packed order notification:`, parsed);
      } catch {
        console.log(`🚚 [DELIVERY_ALERT] Raw message received:`, message);
      }
    } else if (channel === STOCK_UPDATES_CHANNEL) {
      try {
        const parsed = JSON.parse(message);
        console.log(`⚡ [STOCK_UPDATE] Live stock adjustment broadcasted:`, parsed);
      } catch {
        console.log(`⚡ [STOCK_UPDATE] Raw message:`, message);
      }
      stockBroadcaster.emit("stock", message);
    }
  });
}

export async function disconnectRedisSub(): Promise<void> {
  try {
    if (redisSub.status === "ready" || redisSub.status === "connect") {
      await redisSub.unsubscribe(DELIVERY_ALERTS_CHANNEL, STOCK_UPDATES_CHANNEL);
      await redisSub.quit();
    }
    console.log("🔌 Redis Sub disconnected");
  } catch (error) {
    console.error("Error disconnecting Redis Sub:", error);
  }
}
