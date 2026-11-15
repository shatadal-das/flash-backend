import { resetDb } from "./schema";
import { closePool } from "./pool";

async function run() {
  try {
    console.log("Dropping and recreating fresh tables...");
    await resetDb();
    console.log("Database successfully reset with accurate schema and cascade constraints.");
  } catch (err) {
    console.error("Database reset error:", err);
    process.exit(1);
  } finally {
    await closePool();
  }
}

run();
