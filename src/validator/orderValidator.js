import { z } from "zod";

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
    console.error(result.error)
    return res.status(400).json({message: "Invalid order payload"})
  }

  const merged = new Map();
  for (const item of result.data.items) {
    merged.set(item.id_product, (merged.get(item.id_product) ?? 0) + item.quantity);
  }

  for (const [id_product, quantity] of merged) {
    if (quantity > 1000) {
      return res.status(400).json({message: "Max quantity is 1000!"})
    }
  }

  return {
    items: [...merged]
      .map(([id_product, quantity]) => ({ id_product, quantity }))
      .sort((a, b) => a.id_product - b.id_product),
  };
}
