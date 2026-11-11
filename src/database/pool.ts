import { Pool } from "pg";
import { config } from "../config/env";

export const pool = new Pool({
  connectionString: config.databaseUrl,
});

pool.on("error", (err) => {
  console.error("PostgreSQL pool error:", err);
});

export async function closePool(): Promise<void> {
  await pool.end();
}

