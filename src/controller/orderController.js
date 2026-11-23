import pool from "../config/config.js";
import { Schema } from "../validator/Validator.js";

const roundMoney = (value) => Math.round(Number(value) * 100) / 100;

function validateOrderBody(body) {
  const result = Schema.order.safeParse(body);
  if (!result.success) {
    return { error: { status: 400, message: "Invalid order payload", details: result.error.flatten() } };
  }

  const merged = new Map();
  for (const item of result.data.items) {
    merged.set(item.id_product, (merged.get(item.id_product) ?? 0) + item.quantity);
  }

  const items = [...merged]
    .map(([id_product, quantity]) => ({ id_product, quantity }))
    .sort((a, b) => a.id_product - b.id_product);

  for (const item of items) {
    if (item.quantity > 1000) {
      return { error: { status: 400, message: "Max quantity is 1000!" } };
    }
  }

  return { items };
}

async function getOrderItems(conn, items) {
  const ids = items.map((item) => item.id_product);
  const [products] = await conn.execute(
    `SELECT id_product, price, stock FROM products
     WHERE id_product IN (${ids.map(() => "?").join(", ")}) FOR UPDATE`,
    ids,
  );

  const productById = new Map(products.map((product) => [product.id_product, product]));
  const orderItems = [];

  for (const { id_product, quantity } of items) {
    const product = productById.get(id_product);
    if (!product) {
      return { error: { status: 404, message: "Product not found", details: { id_product } } };
    }
    if (Number(product.stock) < quantity) {
      return { error: { status: 409, message: "Product stock is not enough or empty", details: { id_product } } };
    }
    orderItems.push({
      id_product,
      quantity,
      subtotal: roundMoney(Number(product.price) * quantity),
    });
  }

  return { orderItems };
}

async function insertOrder(conn, customerId, orderDate, total) {
  const [inserted] = await conn.execute(
    "INSERT INTO orders (id_customer, order_date, total_price) VALUES (?, ?, ?)",
    [customerId, orderDate, total],
  );
  return inserted.insertId;
}

async function insertOrderDetails(conn, idOrder, orderItems) {
  const placeholders = orderItems.map(() => "(?, ?, ?, ?)").join(", ");
  const values = orderItems.flatMap((item) => [idOrder, item.id_product, item.quantity, item.subtotal]);
  await conn.execute(
    `INSERT INTO order_detail (id_order, id_product, quantity, subtotal) VALUES ${placeholders}`,
    values,
  );
}

async function decreaseProductStock(conn, orderItems) {
  for (const item of orderItems) {
    await conn.execute(
      "UPDATE products SET stock = stock - ? WHERE id_product = ?",
      [item.quantity, item.id_product],
    );
  }
}

async function createPendingPayment(conn, idOrder) {
  const [paymentInserted] = await conn.execute(
    `INSERT INTO payment (id_order, pay_date, payment_method, payment_status)
     VALUES (?, NULL, '-', 'Waiting for payment')`,
    [idOrder],
  );
  return paymentInserted.insertId;
}

export async function CreateOrder(req, res) {
  const orderDate = new Date();
  let conn;

  try {
    const validation = validateOrderBody(req.body);
    if (validation.error) {
      return res.status(validation.error.status).json({
        success: false,
        message: validation.error.message,
        ...(validation.error.details ? { details: validation.error.details } : {}),
      });
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const itemsResult = await getOrderItems(conn, validation.items);
    if (itemsResult.error) {
      await conn.rollback();
      return res.status(itemsResult.error.status).json({
        success: false,
        message: itemsResult.error.message,
        ...(itemsResult.error.details ? { details: itemsResult.error.details } : {}),
      });
    }

    const { orderItems } = itemsResult;
    const total = roundMoney(orderItems.reduce((sum, item) => sum + item.subtotal, 0));
    const idOrder = await insertOrder(conn, req.user.id, orderDate, total);

    await insertOrderDetails(conn, idOrder, orderItems);
    await decreaseProductStock(conn, orderItems);
    const paymentId = await createPendingPayment(conn, idOrder);

    await conn.commit();

    return res.status(201).json({
      success: true,
      message: "Order berhasil dibuat",
      order: { id_order: idOrder, order_date: orderDate, total_price: total, items: orderItems },
      payment: { id_payment: paymentId, id_order: idOrder, payment_status: "Waiting for payment" },
    });
  } catch (error) {
    if (conn) await conn.rollback().catch(() => {});
    const status = ["ER_LOCK_DEADLOCK", "ER_LOCK_WAIT_TIMEOUT"].includes(error.code) ? 409 : 500;
    if (status === 500) console.error("Failed to create order:", error);
    return res.status(status).json({
      success: false,
      message: status === 500 ? "Server error" : error.message,
    });
  } finally {
    conn?.release();
  }
}

export async function CreateOrderFromCart(req, res) {
  const orderDate = new Date();
  let conn;

  try {
    const { selected_cart_ids } = req.body;
    if (!Array.isArray(selected_cart_ids) || selected_cart_ids.length === 0) {
      return res.status(400).json({ success: false, message: "Choose at least 1 product" });
    }

    const cleanCartIds = selected_cart_ids.filter((id) => id !== undefined && id !== null);
    if (cleanCartIds.length !== selected_cart_ids.length) {
      return res.status(400).json({ success: false, message: "Cart ID Invalid" });
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const placeholders = selected_cart_ids.map(() => "?").join(", ");
    const [cartItems] = await conn.execute(
      `SELECT ci.cart_detail_id, ci.product_id, ci.quantity, p.price, p.stock
       FROM cart_detail ci
       JOIN products p ON ci.product_id = p.id_product
       JOIN cart c ON c.cart_id = ci.cart_id
       WHERE c.customer_id = ? AND ci.cart_detail_id IN (${placeholders})`,
      [req.user.id, ...selected_cart_ids],
    );
    if (cartItems.length !== selected_cart_ids.length) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "Some products on your cart is not found" });
    }

    const orderItems = [];
    for (const item of cartItems) {
      if (Number(item.stock) < item.quantity) {
        await conn.rollback();
        return res.status(409).json({ success: false, message: "Product stock is not enough or out of stock" });
      }
      orderItems.push({
        id_product: item.product_id,
        quantity: item.quantity,
        subtotal: roundMoney(Number(item.price) * item.quantity),
      });
    }

    const total = roundMoney(orderItems.reduce((sum, item) => sum + item.subtotal, 0));
    const idOrder = await insertOrder(conn, req.user.id, orderDate, total);

    await insertOrderDetails(conn, idOrder, orderItems);
    await decreaseProductStock(conn, orderItems);

    await conn.execute(
      `DELETE cd FROM cart_detail cd
       JOIN cart c ON c.cart_id = cd.cart_id
       WHERE c.customer_id = ? AND cd.cart_detail_id IN (${placeholders})`,
      [req.user.id, ...selected_cart_ids],
    );

    const paymentId = await createPendingPayment(conn, idOrder);
    await conn.commit();

    return res.status(201).json({
      success: true,
      message: "Order successfuly created",
      order: { id_order: idOrder, order_date: orderDate, total_price: total, items: orderItems },
      payment: { id_payment: paymentId, id_order: idOrder, payment_status: "Waiting for payment" },
    });
  } catch (error) {
    if (conn) await conn.rollback().catch(() => {});
    const status = error.status ?? 500;
    if (status === 500) console.error("Fail to create order:", error);
    return res.status(status).json({
      success: false,
      message: status === 500 ? "Server Error" : error.message,
      ...(error.details ? { details: error.details } : {}),
    });
  } finally {
    conn?.release();
  }
}

export async function CancelOrder(req, res) {
  const { id } = req.params;
  const idOrder = Number(id);

  if (!Number.isInteger(idOrder) || idOrder <= 0) {
    return res.status(400).json({ success: false, message: "Invalid order id" });
  }

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [orders] = await conn.execute(
      "SELECT id_order, id_customer, order_status FROM orders WHERE id_order = ? FOR UPDATE",
      [idOrder],
    );

    if (!orders.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const order = orders[0];

    if (Number(order.id_customer) !== Number(req.user.id)) {
      await conn.rollback();
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    if (order.order_status === "Canceled") {
      await conn.rollback();
      return res.status(409).json({ success: false, message: "Order already canceled" });
    } else if (order.order_status === "Finished") {
      await conn.rollback();
      return res.status(409).json({ success: false, message: "Order cannot be canceled when order is finished" });
    }

    const [result] = await conn.execute(
      "UPDATE orders SET order_status = 'Canceled' WHERE id_order = ? AND order_status <> 'Canceled'",
      [idOrder],
    );

    if (result.affectedRows !== 1) {
      await conn.rollback();
      return res.status(409).json({ success: false, message: "Order status could not be updated" });
    }

    await conn.commit();
    return res.status(200).json({
      success: true,
      message: "Order canceled successfully",
      order: { id_order: idOrder, order_status: "Canceled" },
    });
  } catch (error) {
    if (conn) await conn.rollback().catch(() => {});
    console.error("Failed to cancel order:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    conn?.release();
  }
}

export async function GetOrders(req, res) {
  try {
    const [orders] = await pool.execute(
      `SELECT o.id_order, o.order_date, o.total_price, o.order_status,
              p.payment_status, d.delivery_status
       FROM orders o
       LEFT JOIN payment p ON p.id_order = o.id_order
       LEFT JOIN delivery d ON d.id_order = o.id_order
       WHERE o.id_customer = ?
       ORDER BY o.order_date DESC`,
      [req.user.id],
    );
    return res.status(200).json({ success: true, orders });
  } catch (error) {
    console.error("Failed to get orders:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function GetOrderById(req, res) {
  const idOrder = Number(req.params.id);
  if (!Number.isInteger(idOrder) || idOrder <= 0) {
    return res.status(400).json({ success: false, message: "Invalid order id" });
  }

  try {
    const [rows] = await pool.execute(
      `SELECT o.id_order, o.order_date, o.total_price, o.order_status,
              p.payment_status, p.payment_method, d.delivery_status, d.tracking_number
       FROM orders o
       LEFT JOIN payment p ON p.id_order = o.id_order
       LEFT JOIN delivery d ON d.id_order = o.id_order
       WHERE o.id_order = ? AND o.id_customer = ?`,
      [idOrder, req.user.id],
    );
    if (!rows.length) return res.status(404).json({ success: false, message: "Order not found" });

    const [items] = await pool.execute(
      `SELECT od.id_product, pr.product_name, od.quantity, od.subtotal
       FROM order_detail od
       JOIN products pr ON pr.id_product = od.id_product
       WHERE od.id_order = ?`,
      [idOrder],
    );

    return res.status(200).json({ success: true, order: { ...rows[0], items } });
  } catch (error) {
    console.error("Failed to get order detail:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
