import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";
import path from "path";
import { config } from "../config/env";

export const s3Client = new S3Client({
  endpoint: config.s3.endpoint,
  region: config.s3.region,
  credentials: {
    accessKeyId: config.s3.accessKeyId,
    secretAccessKey: config.s3.secretAccessKey,
  },
  forcePathStyle: true,
});

export async function uploadToStorage(
  fileBuffer: Buffer,
  originalName: string,
  mimeType: string
): Promise<{ url: string; fileName: string }> {
  const ext = path.extname(originalName) || ".jpg";
  const fileName = `${crypto.randomUUID()}${ext}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: config.s3.bucket,
      Key: fileName,
      Body: fileBuffer,
      ContentType: mimeType,
    })
  );

  const url = `${config.s3.endpoint}/${config.s3.bucket}/${fileName}`;
  return { url, fileName };
}
