import { Router } from "express";
import { vendorController } from "../controllers/vendor.controller";
import { asyncHandler } from "../middlewares/asyncHandler";
import { verifyToken, requireRole } from "../middlewares/auth";
import { validateBody } from "../middlewares/validate";
import {
  createStoreSchema,
  createProductSchema,
  updateProductSchema,
} from "../utils/validators";

const router = Router();

// Protect all vendor routes with token verification and VENDOR role
router.use(verifyToken, requireRole(["VENDOR"]));

// ─── Store Management ─────────────────────────────────────
router.post(
  "/store",
  validateBody(createStoreSchema),
  asyncHandler(vendorController.createStore)
);
router.get("/store", asyncHandler(vendorController.getStore));

// ─── Product CRUD ─────────────────────────────────────────
router.post(
  "/products",
  validateBody(createProductSchema),
  asyncHandler(vendorController.createProduct)
);
router.get("/products", asyncHandler(vendorController.getProducts));
router.get("/products/:id", asyncHandler(vendorController.getProductById));
router.put(
  "/products/:id",
  validateBody(updateProductSchema),
  asyncHandler(vendorController.updateProduct)
);
router.delete("/products/:id", asyncHandler(vendorController.deleteProduct));

// ─── Vendor Orders ────────────────────────────────────────
router.get("/orders", asyncHandler(vendorController.getStoreOrders));

export default router;
