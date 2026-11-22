import { z } from "zod";
import { httpError } from "../helper/httpError.js";

const orderItemSchema = z.object({
  id_product: z.number().int().positive(),
  quantity: z.number().int().positive().max(1000),
});

const orderSchema = z.object({
  items: z.array(orderItemSchema).min(1).max(50),
});

export function validateOrderInput(body) {
  const result = orderSchema.safeParse(body);

  if (!result.success) {
    throw httpError(400, "Order payload invalid", result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })));
  }

  const merged = new Map();
  for (const item of result.data.items) {
    merged.set(item.id_product, (merged.get(item.id_product) ?? 0) + item.quantity);
  }

  for (const [id_product, quantity] of merged) {
    if (quantity > 1000) {
      throw httpError(400, "Max quantity is 1000!", { id_product, quantity });
    }
  }

  return {
    items: [...merged]
      .map(([id_product, quantity]) => ({ id_product, quantity }))
      .sort((a, b) => a.id_product - b.id_product),
  };
}
