import { Router, Request, Response } from "express";
import { authController } from "../controllers/auth.controller";
import { asyncHandler } from "../middlewares/asyncHandler";
import { verifyToken, requireRole } from "../middlewares/auth";

const router = Router();

// ─── Public Auth Routes ──────────────────────────────────
router.post("/register", asyncHandler(authController.register));
router.post("/login", asyncHandler(authController.login));
router.post("/refresh", asyncHandler(authController.refresh));

// ─── Protected: Logout (needs verifyToken to get userId) ─
router.post("/logout", verifyToken, asyncHandler(authController.logout));

// ─── RBAC Test Routes ────────────────────────────────────
router.get(
  "/admin-only",
  verifyToken,
  requireRole(["ADMIN"]),
  (_req: Request, res: Response) => {
    res.json({ success: true, message: "Welcome, Admin!" });
  }
);

router.get(
  "/vendor-only",
  verifyToken,
  requireRole(["VENDOR"]),
  (_req: Request, res: Response) => {
    res.json({ success: true, message: "Welcome, Vendor!" });
  }
);

router.get(
  "/delivery-only",
  verifyToken,
  requireRole(["DELIVERY"]),
  (_req: Request, res: Response) => {
    res.json({ success: true, message: "Welcome, Delivery Partner!" });
  }
);

router.get(
  "/customer-only",
  verifyToken,
  requireRole(["CUSTOMER"]),
  (_req: Request, res: Response) => {
    res.json({ success: true, message: "Welcome, Customer!" });
  }
);

export default router;
