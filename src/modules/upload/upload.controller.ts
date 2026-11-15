import { Request, Response } from "express";
import { uploadToStorage } from "../../storage/s3";
import { createAppError } from "../../middleware/error";

export async function handleUploadImage(req: Request, res: Response) {
  const file =
    req.file ||
    (req.files as Record<string, Express.Multer.File[]> | undefined)?.file?.[0] ||
    (req.files as Record<string, Express.Multer.File[]> | undefined)?.image?.[0];

  if (!file) {
    throw createAppError("No image file provided", 400);
  }

  const { url, fileName } = await uploadToStorage(
    file.buffer,
    file.originalname,
    file.mimetype
  );

  res.status(200).json({
    success: true,
    data: {
      url,
      fileName,
    },
  });
}
