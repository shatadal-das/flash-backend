import { app } from "./app";
import { config } from "./config/env";
import { initDb } from "./database/schema";
import { closePool } from "./database/pool";
import { initRedis, closeRedis } from "./events/redis";

export async function startServer() {
  await initDb();
  await initRedis();

  const server = app.listen(config.port, () => {
    console.log(`Flash API running on http://localhost:${config.port}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received. Shutting down...`);
    const forceTimer = setTimeout(() => {
      process.exit(0);
    }, 1500);
    forceTimer.unref();

    try {
      if (typeof (server as any).closeAllConnections === "function") {
        (server as any).closeAllConnections();
      }
      server.close(async () => {
        try {
          await closeRedis();
          await closePool();
        } catch {
        } finally {
          process.exit(0);
        }
      });
    } catch {
      process.exit(0);
    }
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  return server;
}

