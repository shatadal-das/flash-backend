import { Router, Request, Response } from "express";
import { db, stockBroadcaster } from "../config";
import { asyncHandler } from "../middlewares/asyncHandler";

const router = Router();

// GET /api/products/stream - Server-Sent Events (SSE) for real-time stock updates
router.get("/stream", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (typeof (res as any).flushHeaders === "function") {
    (res as any).flushHeaders();
  }

  // Initial event to confirm connection
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

  // Heartbeat ping every 20 seconds to keep connection alive
  const pingTimer = setInterval(() => {
    res.write(": ping\n\n");
  }, 20000);

  req.on("close", () => {
    clearInterval(pingTimer);
    stockBroadcaster.off("stock", onStockUpdate);
    res.end();
  });
});

// GET /api/products - List all products across stores
router.get(
  "/",
  asyncHandler(async (_req: Request, res: Response) => {
    const products = await db.orm.public.Product.where((p) => p.stock.gte(0))
      .include("store")
      .orderBy((p) => p.createdAt.desc())
      .all();

    res.status(200).json({ success: true, data: products });
  })
);

// GET /api/products/:id - Single product with store details
router.get(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const product = await db.orm.public.Product.where((p) => p.id.eq(id))
      .include("store")
      .first();

    if (!product) {
      res.status(404).json({ success: false, message: "Product not found" });
      return;
    }

    res.status(200).json({ success: true, data: product });
  })
);

export default router;
