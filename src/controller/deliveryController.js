import pool from "../config/config.js";

const trackingQuery = `
  SELECT d.id_delivery, d.id_order, d.tracking_number, d.delivery_status,
         o.order_status, o.order_date
  FROM delivery d
  JOIN orders o ON o.id_order = d.id_order
`;

// Seller: list all deliveries for orders containing their products
export async function GetSellerDeliveries(req, res) {
  try {
    const [rows] = await pool.execute(
      `SELECT
         d.id_delivery, d.id_order, d.tracking_number, d.delivery_status,
         o.order_status, o.order_date, o.total_price,
         u.nama AS customer_name,
         da.id_apply, da.proof, da.status AS apply_status,
         GROUP_CONCAT(pr.product_name SEPARATOR ', ') AS products_summary
       FROM delivery d
       JOIN orders o ON o.id_order = d.id_order
       JOIN users u ON u.id_user = o.id_customer
       JOIN order_detail od ON od.id_order = o.id_order
       JOIN products pr ON pr.id_product = od.id_product AND pr.id_user = ?
       LEFT JOIN delivery_apply da ON da.id_order = d.id_order AND da.id_seller = ?
       GROUP BY d.id_delivery, d.id_order, d.tracking_number, d.delivery_status,
                o.order_status, o.order_date, o.total_price,
                u.nama, da.id_apply, da.proof, da.status
       ORDER BY d.id_delivery DESC`,
      [req.user.id, req.user.id]
    );
    return res.status(200).json({ success: true, deliveries: rows });
  } catch (error) {
    console.error("Failed to get seller deliveries:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

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

export async function UpdateDeliveryStatus(req, res) {
  const id = Number(req.params.id);
  const { delivery_status } = req.body;
  const allowed = ["In process", "Out for delivery", "Arrived"];

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ success: false, message: "Invalid delivery id" });
  }
  if (!allowed.includes(delivery_status)) {
    return res.status(400).json({ success: false, message: "Invalid delivery status" });
  }

  try {
    const [result] = await pool.execute(
      "UPDATE delivery SET delivery_status = ? WHERE id_delivery = ?",
      [delivery_status, id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Delivery not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Delivery status updated",
      delivery: { id_delivery: id, delivery_status },
    });
  } catch (error) {
    console.error("Failed to update delivery status:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function ConfirmDelivery(req, res) {
  const idOrder = Number(req.params.id);
  if (!Number.isInteger(idOrder) || idOrder <= 0) {
    return res.status(400).json({ success: false, message: "Invalid order id" });
  }
  if (!req.file) {
    return res.status(400).json({ success: false, message: "Proof image is required" });
  }

  try {
    const [orders] = await pool.execute(
      `SELECT o.id_order, od.id_product, p.id_user AS id_seller
       FROM orders o
       JOIN order_detail od ON od.id_order = o.id_order
       JOIN products p ON p.id_product = od.id_product
       WHERE o.id_order = ? AND o.id_customer = ?
       LIMIT 1`,
      [idOrder, req.user.id],
    );

    if (!orders.length) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const proof = req.file.path || req.file.url;
    const [result] = await pool.execute(
      "INSERT INTO delivery_apply (id_seller, id_order, proof) VALUES (?, ?, ?)",
      [orders[0].id_seller, idOrder, proof],
    );

    return res.status(201).json({
      success: true,
      message: "Delivery confirmation sent",
      data: { id_apply: result.insertId, id_order: idOrder, proof, status: "Sended" },
    });
  } catch (error) {
    console.error("Failed to confirm delivery:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function GetDeliveryApply(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ success: false, message: "Invalid apply id" });
  }

  try {
    const [rows] = await pool.execute(
      "SELECT * FROM delivery_apply WHERE id_apply = ? AND id_seller = ?",
      [id, req.user.id],
    );
    if (!rows.length) return res.status(404).json({ success: false, message: "Delivery apply not found" });

    const apply = rows[0];
    if (apply.status === "Sended") {
      await pool.execute("UPDATE delivery_apply SET status = 'Reviewed' WHERE id_apply = ?", [id]);
      apply.status = "Reviewed";
    }

    return res.status(200).json({ success: true, data: apply });
  } catch (error) {
    console.error("Failed to get delivery apply:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function FinishDeliveryApply(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ success: false, message: "Invalid apply id" });
  }

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [rows] = await conn.execute(
      "SELECT id_apply, id_order, status FROM delivery_apply WHERE id_apply = ? AND id_seller = ? FOR UPDATE",
      [id, req.user.id],
    );
    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Delivery apply not found" });
    }

    await conn.execute("UPDATE delivery_apply SET status = 'Finished' WHERE id_apply = ?", [id]);
    await conn.execute("UPDATE orders SET order_status = 'Finished' WHERE id_order = ?", [rows[0].id_order]);

    await conn.commit();
    return res.status(200).json({ success: true, message: "Delivery apply finished" });
  } catch (error) {
    if (conn) await conn.rollback().catch(() => {});
    console.error("Failed to finish delivery apply:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    conn?.release();
  }
}
