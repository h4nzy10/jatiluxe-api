import pool from "../config/config.js";

const trackingQuery = `
  SELECT d.id_delivery, d.id_order, d.tracking_number, d.delivery_status,
         o.order_status, o.order_date
  FROM delivery d
  JOIN orders o ON o.id_order = d.id_order
`;

export async function GetDeliveryTracking(req, res) {
  try {
    const [deliveries] = await pool.execute(
      `${trackingQuery} WHERE o.id_customer = ? ORDER BY d.id_delivery DESC`,
      [req.user.id],
    );

    return res.status(200).json({ success: true, deliveries });
  } catch (error) {
    console.error("Failed to get delivery tracking:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function GetDeliveryTrackingByOrder(req, res) {
  const idOrder = Number(req.params.id);
  if (!Number.isInteger(idOrder) || idOrder <= 0) {
    return res.status(400).json({ success: false, message: "Invalid order id" });
  }

  try {
    const [rows] = await pool.execute(
      `${trackingQuery} WHERE d.id_order = ? AND o.id_customer = ?`,
      [idOrder, req.user.id],
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Delivery not found" });
    }

    return res.status(200).json({ success: true, delivery: rows[0] });
  } catch (error) {
    console.error("Failed to get delivery tracking:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
