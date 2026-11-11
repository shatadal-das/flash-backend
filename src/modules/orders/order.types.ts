import { z } from "zod";

export const orderItemInputSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  quantity: z.number().int("Quantity must be an integer").positive("Quantity must be at least 1"),
});

export const createOrderSchema = z.object({
  items: z
    .array(orderItemInputSchema)
    .min(1, "Order must contain at least one product item"),
  deliveryAddress: z
    .string()
    .min(5, "Delivery address must be at least 5 characters")
    .max(255),
  deliveryPhone: z.string().optional(),
  deliveryEmail: z.string().email().optional(),
  couponCode: z.string().optional(),
  deliveryLatitude: z.number().min(-90).max(90).optional(),
  deliveryLongitude: z.number().min(-180).max(180).optional(),
});

export type OrderItemInput = z.infer<typeof orderItemInputSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  price: number;
  size: string;
  color: string;
  createdAt: string;
}

export interface Order {
  id: string;
  status: "PENDING" | "ACCEPTED_BY_VENDOR" | "PACKED" | "PICKED_UP" | "DELIVERED";
  totalAmount: number;
  deliveryAddress: string;
  deliveryPhone?: string | null;
  deliveryEmail?: string | null;
  deliveryLatitude?: number | null;
  deliveryLongitude?: number | null;
  couponId?: string | null;
  couponDiscount: number;
  customerId: string;
  storeId: string;
  deliveryPartnerId?: string | null;
  createdAt: string;
  updatedAt: string;
  items?: OrderItem[];
  store?: any;
  coupon?: any;
}

