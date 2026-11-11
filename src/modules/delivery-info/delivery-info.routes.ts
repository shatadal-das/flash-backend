import { Router } from "express";
import { verifyToken } from "../../middleware/auth";
import { validateBody } from "../../middleware/validate";
import { deliveryInfoSchema, updateDeliveryInfoSchema } from "./delivery-info.types";
import {
  handleListAddresses,
  handleCreateAddress,
  handleUpdateAddress,
  handleDeleteAddress,
  handleSetDefaultAddress,
} from "./delivery-info.controller";

const router = Router();
router.use(verifyToken);

router.get("/", handleListAddresses);
router.post("/", validateBody(deliveryInfoSchema), handleCreateAddress);
router.put("/:id", validateBody(updateDeliveryInfoSchema), handleUpdateAddress);
router.delete("/:id", handleDeleteAddress);
router.patch("/:id/default", handleSetDefaultAddress);

export default router;

