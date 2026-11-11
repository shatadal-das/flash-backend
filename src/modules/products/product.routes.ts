import { Router } from "express";
import {
  streamStockUpdates,
  listProducts,
  getProduct,
} from "./product.controller";

const router = Router();

router.get("/stream", streamStockUpdates);
router.get("/", listProducts);
router.get("/:id", getProduct);

export default router;

