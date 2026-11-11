import { Router } from "express";
import { handleHealthCheck } from "./health.controller";

const router = Router();

router.get("/", handleHealthCheck);

export default router;

