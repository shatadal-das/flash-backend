import { Router } from "express";
import { verifyToken, requireRole } from "../../middleware/auth";
import { handleGetDashboard } from "./admin.controller";

const router = Router();
router.use(verifyToken, requireRole(["ADMIN"]));

router.get("/dashboard", handleGetDashboard);

export default router;

