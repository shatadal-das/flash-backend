import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { query, queryOne } from "../db";
import { cache } from "../redis";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  verifyToken,
  requireRole,
  createAppError,
  REFRESH_TOKEN_TTL,
  JwtPayload,
} from "../auth";
import {
  validateBody,
  registerSchema,
  loginSchema,
  refreshSchema,
  RegisterInput,
  LoginInput,
  RefreshInput,
} from "../validators";

const router = Router();

router.post(
  "/register",
  validateBody(registerSchema),
  async (req: Request, res: Response) => {
    const input: RegisterInput = req.body;

    const existing = await queryOne("SELECT id FROM users WHERE email = $1", [
      input.email,
    ]);
    if (existing) {
      throw createAppError("Email already registered", 409);
    }

    const hashedPassword = await bcrypt.hash(input.password, 12);
    const userId = crypto.randomUUID();

    const user = await queryOne<{
      id: string;
      email: string;
      name: string;
      role: JwtPayload["role"];
    }>(
      `INSERT INTO users (id, email, password, name, phone, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, name, role`,
      [userId, input.email, hashedPassword, input.name, input.phone ?? null, input.role]
    );

    const tokenPayload: JwtPayload = { userId: user!.id, role: user!.role };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    await cache.set(`refresh_token:${user!.id}`, refreshToken, REFRESH_TOKEN_TTL);

    res.status(201).json({
      success: true,
      data: {
        user,
        accessToken,
        refreshToken,
      },
    });
  }
);

router.post(
  "/login",
  validateBody(loginSchema),
  async (req: Request, res: Response) => {
    const input: LoginInput = req.body;

    const user = await queryOne<{
      id: string;
      email: string;
      password: string;
      name: string;
      role: JwtPayload["role"];
    }>(
      "SELECT id, email, password, name, role FROM users WHERE email = $1",
      [input.email]
    );

    if (!user || !(await bcrypt.compare(input.password, user.password))) {
      throw createAppError("Invalid email or password", 401);
    }

    const tokenPayload: JwtPayload = { userId: user.id, role: user.role };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    await cache.set(`refresh_token:${user.id}`, refreshToken, REFRESH_TOKEN_TTL);

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        accessToken,
        refreshToken,
      },
    });
  }
);

router.post(
  "/refresh",
  validateBody(refreshSchema),
  async (req: Request, res: Response) => {
    const { refreshToken }: RefreshInput = req.body;

    let decoded: JwtPayload;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch {
      throw createAppError("Invalid or expired refresh token", 401);
    }

    const storedToken = await cache.get<string>(`refresh_token:${decoded.userId}`);
    if (!storedToken || storedToken !== refreshToken) {
      throw createAppError("Refresh token revoked or invalid", 401);
    }

    const tokenPayload: JwtPayload = {
      userId: decoded.userId,
      role: decoded.role,
    };
    const newAccessToken = generateAccessToken(tokenPayload);
    const newRefreshToken = generateRefreshToken(tokenPayload);

    await cache.set(`refresh_token:${decoded.userId}`, newRefreshToken, REFRESH_TOKEN_TTL);

    res.status(200).json({
      success: true,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      },
    });
  }
);

router.post("/logout", verifyToken, async (req: Request, res: Response) => {
  if (req.user) {
    await cache.del(`refresh_token:${req.user.userId}`);
  }
  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
});

router.get("/admin-only", verifyToken, requireRole(["ADMIN"]), (_req, res) => {
  res.json({ success: true, message: "Welcome, Admin!" });
});

router.get("/vendor-only", verifyToken, requireRole(["VENDOR"]), (_req, res) => {
  res.json({ success: true, message: "Welcome, Vendor!" });
});

router.get("/delivery-only", verifyToken, requireRole(["DELIVERY"]), (_req, res) => {
  res.json({ success: true, message: "Welcome, Delivery Partner!" });
});

router.get("/customer-only", verifyToken, requireRole(["CUSTOMER"]), (_req, res) => {
  res.json({ success: true, message: "Welcome, Customer!" });
});

export default router;
