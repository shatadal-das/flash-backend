import { PoolClient } from "pg";
import { pool } from "./pool";

export function toCamel<T = any>(obj: any): T {
  if (!obj || typeof obj !== "object" || obj instanceof Date) return obj;
  if (Array.isArray(obj)) return obj.map(toCamel) as unknown as T;
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z0-9])/g, (_, g) => g.toUpperCase());
    result[camelKey] = toCamel(value);
  }
  return result;
}

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const res = await pool.query(text, params);
  return toCamel<T[]>(res.rows);
}

export async function queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] || null;
}

export async function getClient(): Promise<PoolClient> {
  return await pool.connect();
}

