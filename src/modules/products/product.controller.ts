import { Request, Response } from "express";
import { stockBroadcaster } from "../../events/broadcaster";
import * as productService from "./product.service";

export function streamStockUpdates(req: Request, res: Response) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  res.write(
    `data: ${JSON.stringify({
      type: "connected",
      message: "Subscribed to live stock updates",
      timestamp: new Date().toISOString(),
    })}\n\n`
  );

  const onStockUpdate = (payload: string) => {
    res.write(`data: ${payload}\n\n`);
  };

  stockBroadcaster.on("stock", onStockUpdate);

  const pingTimer = setInterval(() => {
    res.write(": ping\n\n");
  }, 20000);

  req.on("close", () => {
    clearInterval(pingTimer);
    stockBroadcaster.off("stock", onStockUpdate);
    res.end();
  });
}

export async function listProducts(_req: Request, res: Response) {
  const products = await productService.getAllProducts();
  res.status(200).json({ success: true, data: products });
}

export async function getProduct(req: Request, res: Response) {
  const product = await productService.getProductById(req.params.id as string);
  if (!product) {
    res.status(404).json({ success: false, message: "Product not found" });
    return;
  }
  res.status(200).json({ success: true, data: product });
}

