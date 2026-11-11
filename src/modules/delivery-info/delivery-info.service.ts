import crypto from "crypto";
import { query, queryOne } from "../../database/query";
import { createAppError } from "../../middleware/error";
import { DeliveryInfoInput, UpdateDeliveryInfoInput } from "./delivery-info.types";

export async function listAddresses(userId: string) {
  return await query(
    "SELECT * FROM delivery_info WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC",
    [userId]
  );
}

export async function createAddress(userId: string, input: DeliveryInfoInput) {
  const existing = await query("SELECT id FROM delivery_info WHERE user_id = $1", [userId]);
  const shouldBeDefault = input.isDefault || existing.length === 0;

  if (shouldBeDefault && existing.length > 0) {
    await query("UPDATE delivery_info SET is_default = false WHERE user_id = $1", [userId]);
  }

  const id = crypto.randomUUID();
  return await queryOne(
    `INSERT INTO delivery_info (
       id, user_id, label, name, phone, email, address,
       city, state, pincode, is_default
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      id,
      userId,
      input.label || "Home",
      input.name,
      input.phone,
      input.email,
      input.address,
      input.city ?? null,
      input.state ?? null,
      input.pincode ?? null,
      shouldBeDefault,
    ]
  );
}

export async function updateAddress(
  userId: string,
  id: string,
  input: UpdateDeliveryInfoInput
) {
  const address = await queryOne("SELECT * FROM delivery_info WHERE id = $1", [id]);
  if (!address) throw createAppError("Delivery info not found", 404);
  if (address.userId !== userId) {
    throw createAppError("Forbidden: You cannot modify this address", 403);
  }

  if (input.isDefault) {
    await query(
      "UPDATE delivery_info SET is_default = false WHERE user_id = $1 AND id != $2",
      [userId, id]
    );
  }

  return await queryOne(
    `UPDATE delivery_info SET
       label = COALESCE($2, label),
       name = COALESCE($3, name),
       phone = COALESCE($4, phone),
       email = COALESCE($5, email),
       address = COALESCE($6, address),
       city = CASE WHEN $7::text IS NOT NULL THEN $7 ELSE city END,
       state = CASE WHEN $8::text IS NOT NULL THEN $8 ELSE state END,
       pincode = CASE WHEN $9::text IS NOT NULL THEN $9 ELSE pincode END,
       is_default = COALESCE($10, is_default),
       updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      id,
      input.label ?? null,
      input.name ?? null,
      input.phone ?? null,
      input.email ?? null,
      input.address ?? null,
      input.city ?? null,
      input.state ?? null,
      input.pincode ?? null,
      input.isDefault ?? null,
    ]
  );
}

export async function deleteAddress(userId: string, id: string) {
  const address = await queryOne("SELECT * FROM delivery_info WHERE id = $1", [id]);
  if (!address) throw createAppError("Delivery info not found", 404);
  if (address.userId !== userId) {
    throw createAppError("Forbidden: You cannot delete this address", 403);
  }

  await query("DELETE FROM delivery_info WHERE id = $1", [id]);

  if (address.isDefault) {
    await query(
      `UPDATE delivery_info SET is_default = true
       WHERE id = (SELECT id FROM delivery_info WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1)`,
      [userId]
    );
  }
}

export async function setDefaultAddress(userId: string, id: string) {
  const address = await queryOne("SELECT * FROM delivery_info WHERE id = $1", [id]);
  if (!address) throw createAppError("Delivery info not found", 404);
  if (address.userId !== userId) {
    throw createAppError("Forbidden: You cannot modify this address", 403);
  }

  await query("UPDATE delivery_info SET is_default = (id = $2) WHERE user_id = $1", [
    userId,
    id,
  ]);

  return await queryOne("SELECT * FROM delivery_info WHERE id = $1", [id]);
}

