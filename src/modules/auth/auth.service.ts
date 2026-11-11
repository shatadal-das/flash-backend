import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { config } from "../../config/env";
import { queryOne } from "../../database/query";
import { cache } from "../../events/cache";
import { createAppError } from "../../middleware/error";
import { JwtPayload } from "../../middleware/auth";
import { RegisterInput, LoginInput, RefreshInput } from "./auth.types";

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  role: JwtPayload["role"];
  password?: string;
}

export function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwtAccessSecret, { expiresIn: "15m" });
}

export function generateRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwtRefreshSecret, { expiresIn: "7d" });
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, config.jwtRefreshSecret) as JwtPayload;
}

export async function register(input: RegisterInput) {
  const email = input.email.trim().toLowerCase();
  const existing = await queryOne<UserRecord>(
    "SELECT id FROM users WHERE LOWER(email) = $1",
    [email]
  );
  if (existing) {
    throw createAppError("Email already registered", 409);
  }

  const hashedPassword = await bcrypt.hash(input.password, 12);
  const userId = crypto.randomUUID();

  try {
    const user = await queryOne<UserRecord>(
      `INSERT INTO users (id, email, password, name, phone, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, name, role`,
      [userId, email, hashedPassword, input.name.trim(), input.phone?.trim() ?? null, input.role]
    );

    const tokenPayload: JwtPayload = { userId: user!.id, role: user!.role };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    await cache.set(`refresh_token:${user!.id}`, refreshToken, config.refreshTokenTtlSeconds);

    return {
      user,
      accessToken,
      refreshToken,
    };
  } catch (err: any) {
    if (err.code === "23505") {
      throw createAppError("Email already registered", 409);
    }
    throw err;
  }
}

export async function login(input: LoginInput) {
  const email = input.email.trim().toLowerCase();
  const user = await queryOne<UserRecord>(
    "SELECT id, email, password, name, role FROM users WHERE LOWER(email) = $1",
    [email]
  );

  if (!user || !user.password || !(await bcrypt.compare(input.password, user.password))) {
    throw createAppError("Invalid email or password", 401);
  }

  const tokenPayload: JwtPayload = { userId: user.id, role: user.role };
  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  await cache.set(`refresh_token:${user.id}`, refreshToken, config.refreshTokenTtlSeconds);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    accessToken,
    refreshToken,
  };
}

export async function refresh(input: RefreshInput) {
  let decoded: JwtPayload;
  try {
    decoded = verifyRefreshToken(input.refreshToken);
  } catch {
    throw createAppError("Invalid or expired refresh token", 401);
  }

  const storedToken = await cache.get<string>(`refresh_token:${decoded.userId}`);
  if (!storedToken || storedToken !== input.refreshToken) {
    throw createAppError("Refresh token revoked or invalid", 401);
  }

  const tokenPayload: JwtPayload = {
    userId: decoded.userId,
    role: decoded.role,
  };
  const newAccessToken = generateAccessToken(tokenPayload);
  const newRefreshToken = generateRefreshToken(tokenPayload);

  await cache.set(`refresh_token:${decoded.userId}`, newRefreshToken, config.refreshTokenTtlSeconds);

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
}

export async function logout(userId: string): Promise<void> {
  await cache.del(`refresh_token:${userId}`);
}

