import { Router } from "express";
import { upload } from "../../middleware/upload";
import { verifyToken } from "../../middleware/auth";
import { handleUploadImage } from "./upload.controller";

const router = Router();

router.post(
  "/",
  verifyToken,
  upload.fields([
    { name: "file", maxCount: 1 },
    { name: "image", maxCount: 1 },
  ]),
  handleUploadImage
);

export default router;
