import { z } from "zod";

const requiredString = (fieldName, maxLen) => {
  let schema = z.string().trim().min(1, `${fieldName} required`);
  if (maxLen)
    schema = schema.max(maxLen, `${fieldName} max ${maxLen} characters`);
  return schema;
};

const orderItemSchema = z.object({
  id_product: z.number().int().positive(),
  quantity: z.number().int().positive().max(1000),
});

export const Schema = {
  orderItem: z.object({
    items: z.array(orderItemSchema).min(1).max(50),
  }),
  order: z.object({
    items: z.array(orderItemSchema).min(1).max(50),
  }),
  editProfile: z.object({
    nama: requiredString().optional(),
    email: requiredString().optional(),
    password: requiredString().min(6).optional(),
    current_password: requiredString().optional(),
    no_hp: requiredString().optional(),
    alamat: requiredString().optional(),
  }),
  login: z.object({
    email: requiredString("email").email("email invalid"),
    password: requiredString("password"),
  }),
  register: z.object({
    nama: requiredString("nama"),
    email: requiredString("email").email("email invalid"),
    password: requiredString("password"),
    no_hp: requiredString("no_hp"),
    alamat: requiredString("alamat"),
  }),
  product: z.object({
    id_category: z.coerce.number().int().positive(),
    product_name: requiredString("product name"),
    wood_type: requiredString("wood type"),
    price: z.coerce.number().positive(),
    description: requiredString("description"),
    stock: z.coerce.number().int().nonnegative(),
  }),
  addToCart: z.object({
    product_id: z.coerce.number().int().positive(),
    quantity: z.coerce.number().int().positive().max(1000),
  }),
  orderPartial: z.object({
    selected_cart_ids: z.array(z.coerce.number().int().positive()).min(1),
  }),
  payment: z.object({
    id_order: z.coerce.number().int().positive(),
  }),
};

export function validateOrderInput(body) {
  const result = Schema.order.safeParse(body);

  if (!result.success) {
    console.error(result.error);
    return res.status(400).json({ message: "Invalid order payload" });
  }

  const merged = new Map();
  for (const item of result.data.items) {
    merged.set(
      item.id_product,
      (merged.get(item.id_product) ?? 0) + item.quantity,
    );
  }

  for (const [id_product, quantity] of merged) {
    if (quantity > 1000) {
      return res.status(400).json({ message: "Max quantity is 1000!" });
    }
  }

  return {
    items: [...merged]
      .map(([id_product, quantity]) => ({ id_product, quantity }))
      .sort((a, b) => a.id_product - b.id_product),
  };
}

export const validate = (schema) => {
  return (req, res, next) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      return res.status(400).json({ error: result.error.issues });
    }
    req.body = result.data;
    next();
  };
};
