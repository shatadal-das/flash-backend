import { Router } from "express";
import { adminController } from "../controllers/admin.controller";
import { asyncHandler } from "../middlewares/asyncHandler";
import { verifyToken, requireRole } from "../middlewares/auth";

const router = Router();

// Protect all admin routes with ADMIN role
router.use(verifyToken, requireRole(["ADMIN"]));

// ─── Admin Analytics Endpoints ────────────────────────────
// GET /api/admin/dashboard
router.get("/dashboard", asyncHandler(adminController.getDashboard));

export default router;
