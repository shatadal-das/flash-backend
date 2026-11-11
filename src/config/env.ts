import dotenv from "dotenv";
dotenv.config();

export const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "3000", 10),
  databaseUrl:
    process.env.POSTGRES_URI ||
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/postgres",
  redisUri: process.env.REDIS_URI || "redis://localhost:6379",
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || "mytopscret",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || "7df9c21b3e8a7",
  jwtAccessExpiresIn: "15m",
  jwtRefreshExpiresIn: "7d",
  refreshTokenTtlSeconds: 7 * 24 * 60 * 60,
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  allowedOrigins: [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    ...(process.env.CLIENT_URL ? [process.env.CLIENT_URL] : []),
    ...(process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)
      : []),
  ],
};

