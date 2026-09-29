import { Router, Request, Response } from "express";
import { deliveryInfoService } from "../services/deliveryInfo.service";
import { asyncHandler } from "../middlewares/asyncHandler";
import { validateBody } from "../middlewares/validate";
import { verifyToken } from "../middlewares/auth";
import {
  deliveryInfoSchema,
  updateDeliveryInfoSchema,
} from "../utils/validators";

const router = Router();

// All delivery info routes require authentication
router.use(verifyToken);

// GET /api/delivery-info - List saved addresses
router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const list = await deliveryInfoService.getUserDeliveryInfos(req.user!.userId);
    res.status(200).json({ success: true, data: list });
  })
);

// POST /api/delivery-info - Create new delivery address
router.post(
  "/",
  validateBody(deliveryInfoSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const created = await deliveryInfoService.createDeliveryInfo(
      req.user!.userId,
      req.body
    );
    res.status(201).json({
      success: true,
      message: "Delivery info saved successfully",
      data: created,
    });
  })
);

// PUT /api/delivery-info/:id - Update delivery address
router.put(
  "/:id",
  validateBody(updateDeliveryInfoSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const updated = await deliveryInfoService.updateDeliveryInfo(
      req.user!.userId,
      id,
      req.body
    );
    res.status(200).json({
      success: true,
      message: "Delivery info updated successfully",
      data: updated,
    });
  })
);

// DELETE /api/delivery-info/:id - Delete delivery address
router.delete(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const result = await deliveryInfoService.deleteDeliveryInfo(
      req.user!.userId,
      id
    );
    res.status(200).json({ success: true, ...result });
  })
);

// PATCH /api/delivery-info/:id/default - Set address as default
router.patch(
  "/:id/default",
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const updated = await deliveryInfoService.setDefault(
      req.user!.userId,
      id
    );
    res.status(200).json({
      success: true,
      message: "Default delivery address updated",
      data: updated,
    });
  })
);

export default router;
