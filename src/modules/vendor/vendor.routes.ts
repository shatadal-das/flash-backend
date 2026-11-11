import { Router } from "express";
import { verifyToken, requireRole } from "../../middleware/auth";
import { validateBody } from "../../middleware/validate";
import {
  createStoreSchema,
  createProductSchema,
  updateProductSchema,
} from "./vendor.types";
import {
  handleCreateStore,
  handleGetStore,
  handleCreateProduct,
  handleListProducts,
  handleGetProduct,
  handleUpdateProduct,
  handleDeleteProduct,
  handleListOrders,
} from "./vendor.controller";

const router = Router();
router.use(verifyToken, requireRole(["VENDOR"]));

router.post("/store", validateBody(createStoreSchema), handleCreateStore);
router.get("/store", handleGetStore);

router.post("/products", validateBody(createProductSchema), handleCreateProduct);
router.get("/products", handleListProducts);
router.get("/products/:id", handleGetProduct);
router.put("/products/:id", validateBody(updateProductSchema), handleUpdateProduct);
router.delete("/products/:id", handleDeleteProduct);

router.get("/orders", handleListOrders);

export default router;

