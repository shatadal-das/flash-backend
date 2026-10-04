import { Router, Request, Response } from "express";
import { query, queryOne } from "../db";
import { stockBroadcaster } from "../redis";

const router = Router();

router.get("/stream", (req: Request, res: Response) => {
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

  // Ping heartbeat every 20s
  const pingTimer = setInterval(() => {
    res.write(": ping\n\n");
  }, 20000);

  req.on("close", () => {
    clearInterval(pingTimer);
    stockBroadcaster.off("stock", onStockUpdate);
    res.end();
  });
});

router.get("/", async (_req: Request, res: Response) => {
  const products = await query(`
    SELECT p.*,
      CASE WHEN s.id IS NULL THEN NULL ELSE row_to_json(s.*) END AS store
    FROM products p
    LEFT JOIN stores s ON p.store_id = s.id
    WHERE p.stock >= 0
    ORDER BY p.created_at DESC
  `);

  res.status(200).json({ success: true, data: products });
});

router.get("/:id", async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const product = await queryOne(
    `
    SELECT p.*,
      CASE WHEN s.id IS NULL THEN NULL ELSE row_to_json(s.*) END AS store
    FROM products p
    LEFT JOIN stores s ON p.store_id = s.id
    WHERE p.id = $1
    `,
    [id]
  );

  if (!product) {
    res.status(404).json({ success: false, message: "Product not found" });
    return;
  }

  res.status(200).json({ success: true, data: product });
});

export default router;
