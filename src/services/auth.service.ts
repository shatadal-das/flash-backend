import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { db } from "../config";
import { env } from "../config/env";
import { cacheService } from "./redis.service";
import { createAppError } from "../middlewares/errorHandler";
import type { RegisterInput, LoginInput } from "../utils/validators";
import type { JwtPayload } from "../types/express.d";

const SALT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days in seconds

function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
}

function generateRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  });
}

export const authService = {
  async register(input: RegisterInput) {
    // Check if email already exists
    const existing = await db.orm.public.User.where(
      (u) => u.email.eq(input.email)
    ).first();

    if (existing) {
      throw createAppError("Email already registered", 409);
    }

    const hashedPassword = await bcrypt.hash(input.password, SALT_ROUNDS);

    const user = await db.orm.public.User.create({
      email: input.email,
      password: hashedPassword,
      name: input.name,
      phone: input.phone ?? null,
      role: input.role,
    });

    const tokenPayload: JwtPayload = {
      userId: user.id,
      role: user.role as JwtPayload["role"],
    };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Store refresh token in Redis
    await cacheService.set(
      `refresh_token:${user.id}`,
      refreshToken,
      REFRESH_TOKEN_TTL_SECONDS
    );

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
  },

  async login(input: LoginInput) {
    const user = await db.orm.public.User.where(
      (u) => u.email.eq(input.email)
    ).first();

    if (!user) {
      throw createAppError("Invalid email or password", 401);
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.password);
    if (!isPasswordValid) {
      throw createAppError("Invalid email or password", 401);
    }

    const tokenPayload: JwtPayload = {
      userId: user.id,
      role: user.role as JwtPayload["role"],
    };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    await cacheService.set(
      `refresh_token:${user.id}`,
      refreshToken,
      REFRESH_TOKEN_TTL_SECONDS
    );

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
  },

  async refreshToken(token: string) {
    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload;
    } catch {
      throw createAppError("Invalid or expired refresh token", 401);
    }

    // Verify the token matches what's stored in Redis
    const storedToken = await cacheService.get<string>(
      `refresh_token:${decoded.userId}`
    );
    if (!storedToken || storedToken !== token) {
      throw createAppError("Refresh token revoked or invalid", 401);
    }

    const tokenPayload: JwtPayload = {
      userId: decoded.userId,
      role: decoded.role,
    };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Rotate: store new refresh token, old one is implicitly replaced
    await cacheService.set(
      `refresh_token:${decoded.userId}`,
      refreshToken,
      REFRESH_TOKEN_TTL_SECONDS
    );

    return { accessToken, refreshToken };
  },

  async logout(userId: string) {
    // Delete refresh token from Redis → instant session revocation
    await cacheService.del(`refresh_token:${userId}`);
  },
};
