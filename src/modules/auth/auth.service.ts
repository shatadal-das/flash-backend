import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { config } from "../../config/env";
import { queryOne } from "../../database/query";
import { cache } from "../../events/cache";
import { createAppError } from "../../middleware/error";
import { JwtPayload } from "../../middleware/auth";
import { RegisterInput, UpdateProfileInput, LoginInput, RefreshInput } from "./auth.types";

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
       RETURNING id, email, name, phone, role`,
      [userId, email, hashedPassword, input.name.trim(), input.phone?.trim() ?? null, input.role]
    );

    if (input.address && input.address.trim()) {
      const addressId = crypto.randomUUID();
      await queryOne(
        `INSERT INTO delivery_info (id, user_id, label, name, phone, email, address, city, pincode, is_default)
         VALUES ($1, $2, 'Home', $3, $4, $5, $6, $7, $8, TRUE)`,
        [
          addressId,
          userId,
          input.name.trim(),
          input.phone?.trim() || "N/A",
          email,
          input.address.trim(),
          input.city?.trim() || null,
          input.pincode?.trim() || null,
        ]
      );
    }

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
    "SELECT id, email, password, name, phone, role FROM users WHERE LOWER(email) = $1",
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
      phone: user.phone,
      role: user.role,
    },
    accessToken,
    refreshToken,
  };
}

export async function getProfile(userId: string) {
  const user = await queryOne<UserRecord>(
    "SELECT id, email, name, phone, role FROM users WHERE id = $1",
    [userId]
  );
  if (!user) {
    throw createAppError("User not found", 404);
  }
  const defaultAddress = await queryOne(
    "SELECT * FROM delivery_info WHERE user_id = $1 AND is_default = TRUE",
    [userId]
  );
  return {
    ...user,
    defaultAddress: defaultAddress || null,
  };
}

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  const user = await queryOne<UserRecord>(
    `UPDATE users SET
       name = COALESCE($2, name),
       phone = CASE WHEN $3::text IS NOT NULL THEN $3 ELSE phone END,
       updated_at = NOW()
     WHERE id = $1
     RETURNING id, email, name, phone, role`,
    [userId, input.name?.trim() ?? null, input.phone?.trim() ?? null]
  );
  if (!user) {
    throw createAppError("User not found", 404);
  }

  if (input.address && input.address.trim()) {
    const existing = await queryOne(
      "SELECT id FROM delivery_info WHERE user_id = $1 AND is_default = TRUE",
      [userId]
    );
    if (existing) {
      await queryOne(
        `UPDATE delivery_info SET
           address = $2,
           city = COALESCE($3, city),
           pincode = COALESCE($4, pincode),
           phone = COALESCE($5, phone),
           updated_at = NOW()
         WHERE id = $1`,
        [
          existing.id,
          input.address.trim(),
          input.city?.trim() ?? null,
          input.pincode?.trim() ?? null,
          input.phone?.trim() ?? null,
        ]
      );
    } else {
      const addressId = crypto.randomUUID();
      await queryOne(
        `INSERT INTO delivery_info (id, user_id, label, name, phone, email, address, city, pincode, is_default)
         VALUES ($1, $2, 'Home', $3, $4, $5, $6, $7, $8, TRUE)`,
        [
          addressId,
          userId,
          user.name,
          user.phone || "N/A",
          user.email,
          input.address.trim(),
          input.city?.trim() || null,
          input.pincode?.trim() || null,
        ]
      );
    }
  }

  const defaultAddress = await queryOne(
    "SELECT * FROM delivery_info WHERE user_id = $1 AND is_default = TRUE",
    [userId]
  );

  return {
    ...user,
    defaultAddress: defaultAddress || null,
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
