import pool from "../config/config.js"

export async function GetProducts(req, res) {
  try {
    const { search } = req.query;
    let query = "SELECT p.id_product, c.category, u.nama as seller, p.product_name, p.wood_type, p.price, p.stock, p.description, p.picture FROM products p JOIN categories c ON c.id_category = p.id_category JOIN users u ON u.id_user = p.id_user";
    const params = [];

    if (search) {
      query += " WHERE p.product_name LIKE ? OR p.wood_type LIKE ? OR c.category LIKE ?";
      const keyword = `%${search}%`;
      params.push(keyword, keyword, keyword);
    }

    const [products] = await pool.query(query, params);
    if (!products.length) {
      return res.status(404).json({ error: "Product is empty" });
    }
    return res.status(200).json({
      message: "successfuly get products",
      products: products,
    });
  } catch (error) {
    console.error("Failed to get products:", error);
    res.status(500).json({
      success: false,
      message: "Server error.",
    });
  }
}

export async function GetAProduct(req, res) {
  try {
    const [product] = await pool.query(
      "SELECT p.id_product, c.category, u.nama, p.product_name, p.wood_type, p.price, p.stock, p.description, p.picture FROM products p JOIN categories c ON c.id_category = p.id_category JOIN users u ON u.id_user = p.id_user WHERE p.id_product = ?;",
      [req.params.id],
    );
    if (!product.length) {
      return res.status(404).json({
        message: "product is not found",
      });
    }
    return res.status(200).json({
      success: true,
      message: "successfuly get product",
      product: product[0],
    });
  } catch (error) {
    console.error("Failed to get product:", error);
    res.status(500).json({
      success: false,
      message: "Server error.",
    });
  }
}

export async function AddProduct(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "No file uploaded or invalid file format!",
      });
    }
    const picture = req.file.path || req.file.url;

    const { id_category, product_name, wood_type, price, description, stock } = req.body;
    const [result] = await pool.query(
      "INSERT INTO products(id_category, id_user, product_name, wood_type, price, description, picture, stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [id_category, req.user.id, product_name, wood_type, price, description, picture, stock,],
    );

    res.status(200).json({
      message: "New product successfuly created!",
      inserted_product: result[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to create new product!",
      error: error.message,
    });
  }
}

export async function EditProduct(req, res) {
  try {
    const id_category = req.body.id_category || req.body.category;
    const { product_name, wood_type, price, description, stock } = req.body;
    const picture = req.file ? (req.file.path || req.file.url) : req.body.picture;

    let query;
    let params;

    if (picture) {
      query = "UPDATE products SET id_category = ?, product_name = ?, wood_type = ?, price = ?, description = ?, picture = ?, stock = ? WHERE id_product = ?";
      params = [id_category, product_name, wood_type, price, description, picture, stock, req.params.id];
    } else {
      query = "UPDATE products SET id_category = ?, product_name = ?, wood_type = ?, price = ?, description = ?, stock = ? WHERE id_product = ?";
      params = [id_category, product_name, wood_type, price, description, stock, req.params.id];
    }

    const [rows] = await pool.query(query, params);
    return res.status(200).json({
      success: true,
      message: "Product Edited!",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to edit product!",
      error: error.message,
    });
  }
}

export async function DeleteProduct(req, res) {
  try {
    const { id } = req.params;
    const [result] = await pool.execute(
      "DELETE FROM products WHERE id_product = ?",
      [id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Product not found!",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product successfully deleted!",
    });
  } catch (error) {
    console.error("Failed to delete product:", error);
    return res.status(500).json({
      success: false,
      message: "Server error.",
    });
  }
}

export async function GetSellerProducts(req, res) {
  try {
    const [products] = await pool.query(
      "SELECT p.id_product, p.id_category, c.category, u.nama, p.product_name, p.wood_type, p.price, p.stock, p.description, p.picture FROM products p JOIN categories c ON c.id_category = p.id_category JOIN users u ON u.id_user = p.id_user WHERE p.id_user = ?;",
      [req.user.id],
    );

    if (!products.length) {
      return res.status(404).json({ error: "Product is empty" });
    }

    return res.status(200).json({
      message: "successfuly get products",
      products: products,
    });
  } catch (error) {
    console.error("Failed to get products:", error);
    res.status(500).json({
      success: false,
      message: "Server error.",
    });
  }
}

export async function GetCategories(req, res) {
  try {
    const [categories] = await pool.query(
      "SELECT id_category, category FROM categories ORDER BY id_category ASC"
    );
    return res.status(200).json({
      success: true,
      categories: categories,
    });
  } catch (error) {
    console.error("Failed to get categories:", error);
    return res.status(500).json({
      success: false,
      message: "Server error.",
    });
  }
}
