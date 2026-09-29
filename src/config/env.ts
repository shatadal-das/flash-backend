import dotenv from "dotenv";
import path from "path";

// Load environment variables from cwd or parent directories
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

interface EnvConfig {
  NODE_ENV: string;
  PORT: number;
  REDIS_URI: string;
  DATABASE_URL: string;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  CLIENT_URL: string;
  ALLOWED_ORIGINS: string[];
}

const nodeEnv = process.env.NODE_ENV || "development";
const jwtAccessSecret = process.env.JWT_ACCESS_SECRET || "fallback-access-secret";
const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || "fallback-refresh-secret";

if (nodeEnv === "production") {
  if (jwtAccessSecret === "fallback-access-secret" || jwtRefreshSecret === "fallback-refresh-secret") {
    console.warn("⚠️  [SECURITY WARNING] JWT secrets are using fallback values in production! Set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET in your environment.");
  }
}

const rawAllowedOrigins = process.env.ALLOWED_ORIGINS || "";
const parsedAllowedOrigins = rawAllowedOrigins
  ? rawAllowedOrigins.split(",").map((origin) => origin.trim()).filter(Boolean)
  : [];

export const env: EnvConfig = {
  NODE_ENV: nodeEnv,
  PORT: parseInt(process.env.PORT || "3000", 10),
  REDIS_URI: process.env.REDIS_URI || "redis://localhost:6379",
  DATABASE_URL:
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/postgres",
  JWT_ACCESS_SECRET: jwtAccessSecret,
  JWT_REFRESH_SECRET: jwtRefreshSecret,
  CLIENT_URL: process.env.CLIENT_URL || "http://localhost:5173",
  ALLOWED_ORIGINS: parsedAllowedOrigins,
};
