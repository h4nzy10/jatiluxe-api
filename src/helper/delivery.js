import { generateCode } from "./Code.js";

export async function createDeliveryForOrder(conn, idOrder) {
  const [existing] = await conn.execute(
    "SELECT id_delivery, id_order, tracking_number, delivery_status FROM delivery WHERE id_order = ?",
    [idOrder],
  );
  if (existing.length > 0) return existing[0];

  for (let attempt = 0; attempt < 5; attempt++) {
    const trackingNumber = generateCode("JTLX", 10);
    try {
      const [result] = await conn.execute(
        "INSERT INTO delivery (id_order, tracking_number) VALUES (?, ?)",
        [idOrder, trackingNumber],
      );
      return {
        id_delivery: result.insertId,
        id_order: idOrder,
        tracking_number: trackingNumber,
        delivery_status: "In process",
      };
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY" && attempt < 4) continue;
      throw error;
    }
  }

  throw new Error("Failed to generate unique tracking number");
}
