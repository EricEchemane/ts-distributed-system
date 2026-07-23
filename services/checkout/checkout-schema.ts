import { z } from "zod";

export const checkoutRequestSchema = z.object({
  items: z
    .array(
      z.object({
        sku: z.string(),
        qty: z.number().int().positive(),
      }),
    )
    .nonempty(),
});

export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;
