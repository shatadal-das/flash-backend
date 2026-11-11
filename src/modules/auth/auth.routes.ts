import { Router } from "express";
import { validateBody } from "../../middleware/validate";
import { verifyToken, requireRole } from "../../middleware/auth";
import { registerSchema, loginSchema, refreshSchema } from "./auth.types";
import {
  handleRegister,
  handleLogin,
  handleRefresh,
  handleLogout,
  handleRoleAccess,
} from "./auth.controller";

const router = Router();

router.post("/register", validateBody(registerSchema), handleRegister);
router.post("/login", validateBody(loginSchema), handleLogin);
router.post("/refresh", validateBody(refreshSchema), handleRefresh);
router.post("/logout", verifyToken, handleLogout);

router.get("/admin-only", verifyToken, requireRole(["ADMIN"]), handleRoleAccess("Admin"));
router.get("/vendor-only", verifyToken, requireRole(["VENDOR"]), handleRoleAccess("Vendor"));
router.get("/delivery-only", verifyToken, requireRole(["DELIVERY"]), handleRoleAccess("Delivery Partner"));
router.get("/customer-only", verifyToken, requireRole(["CUSTOMER"]), handleRoleAccess("Customer"));

export default router;

