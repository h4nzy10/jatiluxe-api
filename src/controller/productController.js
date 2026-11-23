export async function GetProducts(req, res) {
  try {
    const [products] = await pool.query(
      "SELECT p.id_product, c.category, u.nama, p.product_name, p.wood_type, p.price, p.stock, p.description, p.picture FROM products p JOIN categories c ON c.id_category = p.id_category JOIN users u ON u.id_user = p.id_user;",
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
    if (!req.file) {
      return res.status(400).json({
        message: "No file uploaded or invalid file format!",
      });
    }
    const { category, product_name, wood_type, price, description, stock } = req.body;
    const picture = req.file.path || req.file.url;
    const [rows] = await pool.query(
      "UPDATE products SET id_category = ?, product_name = ?, wood_type = ?, price = ?, description = ?, picture = ?, stock = ? WHERE id_product = ?",
      [category, product_name, wood_type, price, description, picture, stock, req.params.id]
    );
    return res.status(202).json({
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
