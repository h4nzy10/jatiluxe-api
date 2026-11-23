import express from "express";
import pool from "./config/config.js";
import cors from "cors";
import "dotenv/config";
import { verifyToken } from "./middleware/Auth.js";
import { uploadprofile, uploadProduct } from "./middleware/Cloudinary.js";
import { Schema, validate, validateOrderInput } from "./validator/Validator.js";
import { Login, Register, RegisterAsSeller } from "./controller/authController.js";
import { AddProfile, EditProfile, GetProfile } from "./controller/UserProfileController.js";
import { AddProduct, EditProduct, GetAProduct, GetProducts } from "./controller/productController.js";

const app = express();

app.use(express.json());
app.use(cors());

// ========================= Authentication =========================

// login
app.post("/api/v1/login", validate(Schema.login), Login);

// Register
app.post("/api/v1/register", validate(Schema.register),Register);

// Register As Seller
app.post("/api/v1/register/seller", validate(Schema.register),RegisterAsSeller);

// ========================= User & Profile =========================

// Add Profile Picture
app.post("/api/v1/profile-picture", verifyToken, uploadprofile.single("profile"), validate(Schema.profile), AddProfile);

// Get A Profile
app.get("/api/v1/profile", verifyToken, GetProfile);

// Update Profile
app.put("/api/v1/profile", verifyToken, uploadprofile.single("profile"), validate(Schema.editProfile), EditProfile);

//  ========================= Product =========================

// Get All Product
app.get("/api/v1/products", verifyToken, GetProducts);

// Get A Specific Product
app.get("/api/v1/product/:id", verifyToken, GetAProduct);

// Add New product
app.post("/api/v1/product", verifyToken, uploadProduct.single("picture"), AddProduct);

// Edit A Product
app.put("/api/v1/product/:id", verifyToken, validat(Schema.product), EditProduct);

//  ========================= Cart =========================

// Add Product To Cart
app.post("/api/v1/cart", verifyToken, async (req, res) => {
  try {
    const { product_id, quantity } = req.body;

    const [existing] = await pool.execute(
    "SELECT cart_id FROM cart WHERE customer_id = ?",
    [req.user.id],
  );

   let cartId;

  if (existing.length > 0) {
    cartId = existing[0].cart_id;
  } else {
    const [created] = await pool.execute(
      "INSERT INTO cart(customer_id) VALUES (?)",
      [req.user.id],
    );
    cartId = created.insertId;
  }
    const [detail] = await pool.query("INSERT INTO cart_detail(cart_id, product_id, quantity) values (?, ?, ?)",
      [cartId, product_id, quantity]
    );
    return res.status(201).json({
      success: true,
      message: "Product successfuly added to cart",
      cart: cartId,
      detail: detail[0]
    })
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to add product to cart!",
      error: error.message,
    });
  }
});

// Get Cart List
app.get("/api/v1/cart-list", verifyToken, async (req, res) => {
  try {
    const [cart] = await pool.query("SELECT c.cart_id, p.product_name, p.price, d.quantity, (p.price * d.quantity) AS subtotal FROM cart c JOIN cart_detail d ON c.cart_id = d.cart_id JOIN products p ON d.product_id = p.id_product WHERE c.customer_id = ?",
      [req.user.id]
    );
    return res.status(200).json({
      success: true,
      message: "Successfuly get cart",
      cart: cart
    })
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to get cart list!",
      error: error.message,
    });
  }  
});

//  ========================= Order =========================

// Order A Product
app.post("/api/v1/order", verifyToken, async (req, res) => {
   const money = (value) => Math.round(Number(value) * 100) / 100;
  const orderDate = new Date();
  let conn;

  try {
    const { items } = validateOrderInput(req.body);
    const ids = items.map((item) => item.id_product);

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [products] = await conn.execute(
      `SELECT id_product, price, stock FROM products
       WHERE id_product IN (${ids.map(() => "?").join(", ")}) FOR UPDATE`,
      ids,
    );
    const byId = new Map(products.map((product) => [product.id_product, product]));

    const orderItems = items.map(({ id_product, quantity }) => {
      const product = byId.get(id_product);
      if (!product) return res.status(404).json({message: "Product not found"})
      if (Number(product.stock) < quantity) {
        return res.status(409).json({message: "Product stock is not enough or empty"})
      }
      return { id_product, quantity, subtotal: money(Number(product.price) * quantity) };
    });
    const total = money(orderItems.reduce((sum, item) => sum + item.subtotal, 0));

    const [inserted] = await conn.execute(
      "INSERT INTO orders (id_customer, order_date, total_price) VALUES (?, ?, ?)",
      [req.user.id, orderDate, total],
    );
    const idOrder = inserted.insertId;

    const placeholders = orderItems.map(() => "(?, ?, ?, ?)").join(", ");
    const values = orderItems.flatMap((item) => [
      idOrder, item.id_product, item.quantity, item.subtotal,
    ]);
    await conn.execute(
      `INSERT INTO order_detail (id_order, id_product, quantity, subtotal) VALUES ${placeholders}`,
      values,
    );

    for (const item of orderItems) {
      await conn.execute(
        "UPDATE products SET stock = stock - ? WHERE id_product = ?",
        [item.quantity, item.id_product],
      );
    }

     const [paymentInserted] = await conn.execute(
      `INSERT INTO payments (id_order, pay_date, payment_method, payment_status)
       VALUES (?, NULL, NULL, 'pending')`,
      [idOrder]);

    await conn.commit();

    return res.status(201).json({
      success: true,
      message: "Order berhasil dibuat",
      order: { id_order: idOrder, order_date: orderDate, total_price: total, items: orderItems },
      payment: {
        id_payment: paymentInserted.insertId,
        id_order: idOrder,
        payment_status: "Waiting for payment"
      }
    });
  } catch (error) {
    if (conn) await conn.rollback().catch(() => {});
    const status = error.status ?? (["ER_LOCK_DEADLOCK", "ER_LOCK_WAIT_TIMEOUT"].includes(error.code) ? 409 : 500);
    if (status === 500) console.error("Failed to create order:", error);
    return res.status(status).json({
      success: false,
      message: status === 500 ? "Server error" : error.message,
      ...(error.details ? { details: error.details } : {}),
    });
  } finally {
    conn?.release();
  }
});

// Make Order From Cart
app.post("/api/v1/order/partial", verifyToken, async (req, res) => {
  const money = (value) => Math.round(Number(value) * 100) / 100;
  const orderDate = new Date();
  let conn;

  try {
    const { selected_cart_ids } = req.body; 
    if (!selected_cart_ids || !selected_cart_ids.length) {
      throw httpError(400, "Tidak ada item yang dipilih untuk checkout");
    }
    const cleanCartIds = selected_cart_ids.filter((id) => id !== undefined && id !== null);
    if (cleanCartIds.length !== selected_cart_ids.length) {
      throw httpError(400, "Terdapat ID keranjang yang tidak valid (undefined/null)");
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
      [req.user.id, ...selected_cart_ids]
    );

    if (cartItems.length !== selected_cart_ids.length) {
      return res.status(400).json({message: "Some products on your cart is not found"})
    }

    const orderItems = cartItems.map((item) => {
      if (Number(item.stock) < item.quantity) {
        return res.status(409).json({message: "Product stock is not enough or out of stock"})
      }
      return {
        id_product: item.product_id,
        quantity: item.quantity,
        subtotal: money(Number(item.price) * item.quantity),
      };
    });
    
    const total = money(orderItems.reduce((sum, item) => sum + item.subtotal, 0));

    const [inserted] = await conn.execute(
      "INSERT INTO orders (id_customer, order_date, total_price) VALUES (?, ?, ?)",
      [req.user.id, orderDate, total]
    );
    const idOrder = inserted.insertId;

    const detailPlaceholders = orderItems.map(() => "(?, ?, ?, ?)").join(", ");
    const values = orderItems.flatMap((item) => [idOrder, item.id_product, item.quantity, item.subtotal]);
    await conn.execute(
      `INSERT INTO order_detail (id_order, id_product, quantity, subtotal) VALUES ${detailPlaceholders}`,
      values
    );

     for (const item of orderItems) {
      await conn.execute(
        "UPDATE products SET stock = stock - ? WHERE id_product = ?",
        [item.quantity, item.id_product]
      );
    }

    await conn.execute(
      `DELETE cd FROM cart_detail cd JOIN cart c ON c.cart_id = cd.cart_id WHERE c.customer_id = ? AND cd.cart_detail_id IN (${placeholders})`,
      [req.user.id, ...selected_cart_ids]
    );

    const [paymentInserted] = await conn.execute(
      `INSERT INTO payments (id_order, pay_date, payment_method, payment_status)
       VALUES (?, NULL, NULL, 'pending')`,
      [idOrder]
    );

    await conn.execute(
      `DELETE cd FROM cart_detail cd JOIN cart c ON c.cart_id = cd.cart_id WHERE c.customer_id = ? AND cd.cart_detail_id IN (${placeholders})`,
      [req.user.id, ...selected_cart_ids]
    );

    await conn.commit();

    return res.status(201).json({
      success: true,
      message: "Order successfuly created",
      order: { id_order: idOrder, order_date: orderDate, total_price: total, items: orderItems },
      payment: {
        id_payment: paymentInserted.insertId,
        id_order: idOrder,
        payment_status: "Waiting for payment"
      }
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
});

// Transaction
app.post("/api/v1/payments", verifyToken, async (req, res) => {
  const idOrder = Number(req.body.id_order);
  if (!Number.isInteger(idOrder) || idOrder <= 0) {
    return res.status(400).json({ message: "Invalid Order" });
  }
  let conn;

  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [rows] = await conn.execute(
      `SELECT p.id_payment, p.id_order, p.payment_status, p.pay_date, p.payment_method,
              o.id_customer, o.total_price
       FROM payment p
       JOIN orders o ON o.id_order = p.id_order
       WHERE p.id_order = ?
       FOR UPDATE`,
      [idOrder]
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

    if (payment.payment_status === "Paid off") {
      await conn.rollback();
      return res.status(409).json({
        message: "Succcessfuly",
        payment: { id_payment: payment.id_payment, id_order: payment.id_order, payment_status: payment.payment_status }
      });
    }

    if (payment.payment_status !== "Waiting for payment") {
      await conn.rollback();
      return res.status(409).json({ message: `Cannot proccess payment: ${payment.payment_status}` });
    }

    const [result] = await conn.execute(
      `UPDATE payments
       SET payment_status = 'Paid off', payment_method = '?', pay_date = NOW()
       WHERE id_payment = ? AND payment_status = 'Waiting for payment'`,
      [payment.id_payment, req.body.payment_method]
    );

    if (result.affectedRows !== 1) {
      await conn.rollback();
      return res.status(409).json({ message: "Payment status has changed!" });
    }

    await conn.commit();
    return res.status(200).json({
      success: true,
      message: "Payment Proccessed Succesfully",
      payment: {
        id_payment: payment.id_payment,
        id_order: payment.id_order,
        payment_status: "Paid off",
        payment_method: req.body.payment_method
      }
    });
  } catch (error) {
    if (conn) await conn.rollback().catch(() => {});
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  } finally {
    conn?.release();
  }
});

app.listen(3000, () => {
  console.log(`JatiLuxe activated on port 3000`);
});