import { query, queryOne } from "../../database/query";
import { Product } from "./product.types";

export async function getAllProducts(): Promise<Product[]> {
  return await query<Product>(`
    SELECT p.*,
      CASE WHEN s.id IS NULL THEN NULL ELSE row_to_json(s.*) END AS store
    FROM products p
    LEFT JOIN stores s ON p.store_id = s.id
    WHERE p.stock >= 0
    ORDER BY p.created_at DESC
  `);
}

export async function getProductById(id: string): Promise<Product | null> {
  return await queryOne<Product>(
    `
    SELECT p.*,
      CASE WHEN s.id IS NULL THEN NULL ELSE row_to_json(s.*) END AS store
    FROM products p
    LEFT JOIN stores s ON p.store_id = s.id
    WHERE p.id = $1
    `,
    [id]
  );
}

