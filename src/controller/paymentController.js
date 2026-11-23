import pool from "../config/config.js";
import { createDeliveryForOrder } from "../helper/delivery.js";

export async function Payment(req, res) {
  const { id_order, payment_method } = req.body;
  const idOrder = Number(id_order);

  if (!Number.isInteger(idOrder) || idOrder <= 0) {
    return res.status(400).json({ message: "Invalid Order" });
  }

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [rows] = await conn.execute(
      `SELECT p.id_payment, p.id_order, p.payment_status,
              o.id_customer, o.order_status
       FROM payment p
       JOIN orders o ON o.id_order = p.id_order
       WHERE p.id_order = ?
       FOR UPDATE`,
      [idOrder],
    );

    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ message: "Payment not found!" });
    }

    const payment = rows[0];

    if (Number(payment.id_customer) !== Number(req.user.id)) {
      await conn.rollback();
      return res.status(403).json({ message: "Access denied" });
    }

    if (payment.order_status === "Canceled") {
      await conn.rollback();
      return res.status(409).json({ message: "Order is canceled" });
    }

    if (["Paid off"].includes(payment.payment_status)) {
      await conn.rollback();
      return res.status(409).json({ message: "Payment already completed" });
    }

    if (!["Waiting for payment"].includes(payment.payment_status)) {
      await conn.rollback();
      return res.status(409).json({ message: `Cannot process payment: ${payment.payment_status}` });
    }

    const [result] = await conn.execute(
      `UPDATE payment
       SET payment_status = 'Paid off', payment_method = ?, pay_date = NOW()
       WHERE id_payment = ? AND payment_status = ?`,
      [payment_method, payment.id_payment, payment.payment_status],
    );

    if (result.affectedRows !== 1) {
      await conn.rollback();
      return res.status(409).json({ message: "Payment status has changed!" });
    }

    await conn.execute("UPDATE orders SET order_status = 'Process' WHERE id_order = ?", [idOrder]);
    const delivery = await createDeliveryForOrder(conn, idOrder);

    await conn.commit();
    return res.status(200).json({
      success: true,
      message: "Payment processed successfully",
      payment: {
        id_payment: payment.id_payment,
        id_order: payment.id_order,
        payment_status: "Paid off",
        payment_method,
      },
      delivery,
    });
  } catch (error) {
    if (conn) await conn.rollback().catch(() => {});
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  } finally {
    conn?.release();
  }
}
