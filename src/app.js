import express from "express";
import pool from "./config/config.js";
import cors from "cors";
import "dotenv/config";
import { generateAccessToken } from "./helper/token.js";
import { verifyToken } from "./middleware/Auth.js";
import { uploadprofile, uploadProduct } from "./middleware/Cloudinary.js";
import { validateOrderInput } from "./validator/orderValidator.js";
import { httpError } from "./helper/httpError.js";

const app = express();

app.use(express.json());
app.use(cors());

// ========================= Authentication =========================

// login
app.post("/api/v1/login", async (req, res) => {
  try {
    const [user] = await pool.query(
      "SELECT * FROM users WHERE email = ? AND password = ?;",
      [req.body.email, req.body.password],
    );

    if (!user.length) {
      return res.status(400).json({
        message: "Login failed!",
      });
    }

    const token = generateAccessToken(user[0]);

    res.status(201).json({
      message: "Login success!",
      token: token,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Terjadi kesalahan server", error });
  }
});

// Register
app.post("/api/v1/register", async (req, res) => {
  try {
    const [rows] = await pool.execute(
      "INSERT INTO users (nama, email, password, no_hp, alamat) VALUES (?, ?, ?, ?, ?)",
      [
        req.body.nama,
        req.body.email,
        req.body.password,
        req.body.no_hp,
        req.body.alamat,
      ],
    );
    const token = generateAccessToken({ id: rows.insertId });

    res.status(201).json({
      message: "Register success!",
      token: token,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Terjadi kesalahan server", error });
  }
});

// Register As Seller
app.post("/api/v1/register/seller", async (req, res) => {
  const [seller] = await pool.query(
    "INSERT INTO users (nama, email, password, role, no_hp, alamat) VALUES (?, ?, ?, 2, ?, ?)",
    [
      req.body.nama,
      req.body.email,
      req.body.password,
      req.body.no_hp,
      req.body.alamat,
    ],
  );
});

// ========================= User & Profile =========================

// Add Profile Picture
app.post(
  "/api/v1/profile-picture",
  verifyToken,
  uploadprofile.single("profile"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          message: "No file uploaded or invalid file format!",
        });
      }
      const profileUrl = req.file.path || req.file.url;

      const [result] = await pool.query(
        "UPDATE users SET profile = ? WHERE id_user = ?",
        [profileUrl, req.user.id],
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          message: "User not found!",
        });
      }
      res.status(200).json({
        message: "Profile picture successfully uploaded!",
        profile_picture: profileUrl,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        message: "Failed to update profile picture!",
        error: error.message,
      });
    }
  },
);

// Get A Profile
app.get("/api/v1/profile", verifyToken, async (req, res) => {
  try {
    const [profile] = await pool.query(
      "SELECT profile, nama, email, password, role, no_hp, alamat FROM users WHERE id_user = ?",
      [req.user.id],
    );
    if (!profile.length) {
      return res.status(404).json({ error: "User not found" });
    }
    return res.status(200).json({
      message: "successfuly get profile",
      user: profile[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to get profile!",
      error: error,
    });
  }
});

// Update Profile
app.put("/api/v1/profile", verifyToken, uploadprofile.single("profile"),async (req, res) => {
  const userId = req.user.id;
  const { nama, email, password, no_hp, alamat, profile } = req.body;

  let fields = [];
  let values = [];

  if (nama !== undefined && nama !== "") {
    fields.push("nama = ?");
    values.push(nama);
  }
  if (email !== undefined && email !== "") {
    fields.push("email = ?");
    values.push(email);
  }
  if (password !== undefined && password !== "") {
    fields.push("password = ?");
    values.push(password);
  }
  if (no_hp !== undefined && no_hp !== "") {
    fields.push("no_hp = ?");
    values.push(no_hp);
  }
  if (alamat !== undefined && alamat !== "") {
    fields.push("alamat = ?");
    values.push(alamat);
  }
  if (profile !== undefined && profile !== "") {
    fields.push("profile = ?");
    values.push(profile);
  }

  if (fields.length === 0) {
    return res.status(400).json({
      success: false,
      message: "You need to update at least 1 fields.",
    });
  }
  values.push(userId);
  try {
    const query = `UPDATE users SET ${fields.join(", ")} WHERE id_user = ?`;

    const [result] = await pool.execute(query, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }
    res.status(200).json({
      success: true,
      message: "Profile successfuly updated!",
    });
  } catch (error) {
    console.error("Failed to update profile:", error);
    res.status(500).json({
      success: false,
      message: "Server error.",
    });
  }
});

//  ========================= Product =========================
// Get All Product
app.get("/api/v1/products", verifyToken, async (req, res) => {
  try {
    const [products] = await pool.query("SELECT p.id_product, c.category, u.nama, p.product_name, p.wood_type, p.price, p.stock, p.description, p.picture FROM products p JOIN categories c ON c.id_category = p.id_category JOIN users u ON u.id_user = p.id_user;")
    if (!products.length) {
      return res.status(404).json({ error: "Product is empty" });
    }
    return res.status(200).json({
      message: "successfuly get products",
      user: products[0],
    });
  } catch (error) {
    console.error("Failed to get products:", error);
    res.status(500).json({
      success: false,
      message: "Server error.",
    });
  }  
});

// Get A Specific Product
app.get("/api/v1/product/:id", verifyToken, async (req, res) => {
  try {
    const [product] = await pool.query("SELECT p.id_product, c.category, u.nama, p.product_name, p.wood_type, p.price, p.stock, p.description, p.picture FROM products p JOIN categories c ON c.id_category = p.id_category JOIN users u ON u.id_user = p.id_user WHERE p.id_product = ?;",
      [req.params.id]
    );if (!product.length) {
      return res.status(404).json({
        message: "product is not found",
      })
    }
    return res.status(200).json({
      success: true,
      message: "successfully get product",
      product: product[0],
    })
    
  } catch (error) {
    console.error("Failed to get product:", error);
    res.status(500).json({
      success: false,
      message: "Server error.",
    }); 
  }
});

// Add New product
app.post("/api/v1/product", verifyToken, uploadProduct.single("picture"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "No file uploaded or invalid file format!",
      });
    }
    const profileUrl = req.file.path || req.file.url;

    const [result] = await pool.query(
      "UPDATE users SET profile = ? WHERE id_user = ?",
      [profileUrl, req.user.id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "User not found!",
      });
    }
    res.status(200).json({
      message: "Profile picture successfully uploaded!",
      profile_picture: profileUrl,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to update profile picture!",
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

    // satu loop: cek produk + stok SEKALIGUS hitung subtotal
    const orderItems = items.map(({ id_product, quantity }) => {
      const product = byId.get(id_product);
      if (!product) throw httpError(404, `Produk ${id_product} tidak ditemukan`);
      if (Number(product.stock) < quantity) {
        throw httpError(409, `Stok produk ${id_product} tidak cukup`, {
          id_product, tersedia: Number(product.stock), diminta: quantity,
        });
      }
      return { id_product, quantity, subtotal: money(Number(product.price) * quantity) };
    });
    const total = money(orderItems.reduce((sum, item) => sum + item.subtotal, 0));

    const [inserted] = await conn.execute(
      "INSERT INTO orders (id_customer, order_date, total_price) VALUES (?, ?, ?)",
      [req.user.id, orderDate, total],
    );
    const idOrder = inserted.insertId;

    // batch insert detail (1 query, bukan N query)
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
    await conn.commit();

    return res.status(201).json({
      success: true,
      message: "Order berhasil dibuat",
      order: { id_order: idOrder, order_date: orderDate, total_price: total, items: orderItems },
    });
  } catch (error) {
    if (conn) await conn.rollback().catch(() => {});
    const status = error.status ?? (["ER_LOCK_DEADLOCK", "ER_LOCK_WAIT_TIMEOUT"].includes(error.code) ? 409 : 500);
    if (status === 500) console.error("Gagal membuat order:", error);
    return res.status(status).json({
      success: false,
      message: status === 500 ? "Terjadi kesalahan server" : error.message,
      ...(error.details ? { details: error.details } : {}),
    });
  } finally {
    conn?.release();
  }
});

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

app.listen(3000, () => {
  console.log(`JatiLuxe activated on port 3000`);
});