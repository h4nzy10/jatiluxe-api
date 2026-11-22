import express from "express";
import pool from "./config/config.js";
import cors from "cors";
import "dotenv/config";
import { generateAccessToken } from "./helper/token.js";
import { verifyToken } from "./middleware/Auth.js";
import { uploadprofile, uploadProduct } from "./middleware/Cloudinary.js";

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
    const [products] = await pool.query("SELECT p.id_product, c.category, u.nama, p.product_name, p.wood_type, p.description, p.picture FROM products p JOIN categories c ON c.id_category = p.id_category JOIN users u ON u.id_user = p.id_user")
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
    const [product] = await pool.query("SELECT p.id_product, c.category, u.nama, p.product_name, p.wood_type, p.description, p.picture FROM products p JOIN categories c ON c.id_category = p.id_category JOIN users u ON u.id_user = p.id_user WHERE p.id_product = ?",
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

// Order A Prouct
app.post("/api/v1/order", async (req, res) => {
  const [rows] = await pool.query("")
});

app.listen(3000, () => {
  console.log(`JatiLuxe activated on port 3000`);
});