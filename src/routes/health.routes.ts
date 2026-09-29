import { Router } from "express";
import { healthController } from "../controllers";
import { asyncHandler } from "../middlewares";

const router = Router();

router.get("/", asyncHandler(healthController.check));

export default router;
