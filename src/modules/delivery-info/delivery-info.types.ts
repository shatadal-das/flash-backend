import { z } from "zod";

export const deliveryInfoSchema = z.object({
  label: z.string().min(1, "Label is required").max(50).default("Home"),
  name: z.string().min(2, "Recipient name is required").max(100),
  phone: z.string().min(7, "Phone number must be at least 7 digits").max(20),
  email: z.string().email("Valid email is required"),
  address: z.string().min(5, "Full street address must be at least 5 characters").max(255),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  pincode: z.string().max(20).optional(),
  isDefault: z.boolean().default(false),
});

export const updateDeliveryInfoSchema = deliveryInfoSchema.partial();

export type DeliveryInfoInput = z.infer<typeof deliveryInfoSchema>;
export type UpdateDeliveryInfoInput = z.infer<typeof updateDeliveryInfoSchema>;

