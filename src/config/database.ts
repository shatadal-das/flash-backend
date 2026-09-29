import { Temporal } from "@js-temporal/polyfill";

// Polyfill Temporal globally for Prisma v8 datetime mutations
if (typeof (globalThis as unknown as { Temporal?: unknown }).Temporal === "undefined") {
  (globalThis as unknown as { Temporal: typeof Temporal }).Temporal = Temporal;
}

import { db } from "../prisma/db";

// Re-export the Prisma v8 db client
export { db };

export async function connectDatabase(): Promise<void> {
  try {
    await db.connect();
    console.log("✅ PostgreSQL connected via Prisma");
  } catch (error) {
    console.error("❌ PostgreSQL connection failed:", error);
    process.exit(1);
  }
}

export async function disconnectDatabase(): Promise<void> {
  await db.close();
  console.log("🔌 PostgreSQL disconnected");
}
