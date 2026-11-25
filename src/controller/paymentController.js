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

export async function CancelPayment(req, res) {
  const idOrder = Number(req.params.id);
  if (!Number.isInteger(idOrder) || idOrder <= 0) {
    return res.status(400).json({ message: "Invalid order id" });
  }

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [rows] = await conn.execute(
      `SELECT p.id_payment, p.payment_status, o.id_customer
       FROM payment p
       JOIN orders o ON o.id_order = p.id_order
       WHERE p.id_order = ? FOR UPDATE`,
      [idOrder],
    );

    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ message: "Payment not found" });
    }

    const payment = rows[0];
    if (Number(payment.id_customer) !== Number(req.user.id)) {
      await conn.rollback();
      return res.status(403).json({ message: "Access denied" });
    }

    if (payment.payment_status === "Canceled") {
      await conn.rollback();
      return res.status(409).json({ message: "Payment already canceled" });
    }

    if (payment.payment_status === "Paid off") {
      await conn.rollback();
      return res.status(409).json({ message: "Paid payment cannot be canceled" });
    }

    await conn.execute(
      "UPDATE payment SET payment_status = 'Canceled' WHERE id_payment = ?",
      [payment.id_payment],
    );

    await conn.commit();
    return res.status(200).json({
      success: true,
      message: "Payment canceled successfully",
      payment: { id_payment: payment.id_payment, id_order: idOrder, payment_status: "Canceled" },
    });
  } catch (error) {
    if (conn) await conn.rollback().catch(() => {});
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  } finally {
    conn?.release();
  }
}

export async function GetTransactionDetail(req, res) {
  const idOrder = Number(req.params.id);
  if (!Number.isInteger(idOrder) || idOrder <= 0) {
    return res.status(400).json({ message: "Invalid order id" });
  }

  try {
    const [rows] = await pool.execute(
      `SELECT p.id_payment, p.id_order, p.payment_status, p.payment_method, p.pay_date,
              o.order_date, o.total_price, o.order_status, o.id_customer
       FROM payment p
       JOIN orders o ON o.id_order = p.id_order
       WHERE p.id_order = ?`,
      [idOrder],
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    const transaction = rows[0];
    if (Number(transaction.id_customer) !== Number(req.user.id)) {
      return res.status(403).json({ message: "Access denied" });
    }

    return res.status(200).json({ success: true, transaction });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function GetSales(req, res) {
  try {
    const [rows] = await pool.execute(
      `SELECT o.id_order, o.order_date, o.total_price, o.order_status,
              p.payment_status, p.payment_method, p.pay_date
       FROM orders o
       JOIN payment p ON p.id_order = o.id_order
       JOIN order_detail od ON od.id_order = o.id_order
       JOIN products pr ON pr.id_product = od.id_product
       WHERE pr.id_user = ? AND p.payment_status = 'Paid off'
       GROUP BY o.id_order, o.order_date, o.total_price, o.order_status, p.payment_status, p.payment_method, p.pay_date
       ORDER BY o.order_date DESC`,
      [req.user.id],
    );

    const totalSales = rows.reduce((sum, row) => sum + Number(row.total_price), 0);
    return res.status(200).json({ success: true, total_sales: totalSales, sales: rows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
}
