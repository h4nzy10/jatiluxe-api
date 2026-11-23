import pool from "../config/config.js";

export async function AddToCart(req, res) {
  try {
    const { product_id, quantity } = req.body;

    const [existingCart] = await pool.execute(
      "SELECT cart_id FROM cart WHERE customer_id = ?",
      [req.user.id],
    );

    let cartId;
    if (existingCart.length > 0) {
      cartId = existingCart[0].cart_id;
    } else {
      const [createdCart] = await pool.execute(
        "INSERT INTO cart(customer_id) VALUES (?)",
        [req.user.id],
      );
      cartId = createdCart.insertId;
    }

    const [detail] = await pool.execute(
      "INSERT INTO cart_detail(cart_id, product_id, quantity) VALUES (?, ?, ?)",
      [cartId, product_id, quantity],
    );

    return res.status(201).json({
      success: true,
      message: "Product successfully added to cart",
      cart: cartId,
      detail: detail,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Failed to add product to cart!",
      error: error.message,
    });
  }
}

export async function GetCartList(req, res) {
  try {
    const [cartItems] = await pool.query(
      `SELECT c.cart_id, d.cart_detail_id, p.product_name, p.price, d.quantity, (p.price * d.quantity) AS subtotal
       FROM cart c
       JOIN cart_detail d ON c.cart_id = d.cart_id
       JOIN products p ON d.product_id = p.id_product
       WHERE c.customer_id = ?`,
      [req.user.id],
    );

    return res.status(200).json({
      success: true,
      message: "Successfully get cart",
      cart: cartItems,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Failed to get cart list!",
      error: error.message,
    });
  }
}

export async function UpdateCartItem(req, res) {
  const id = Number(req.params.id);
  const quantity = Number(req.body.quantity);
  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(quantity) || quantity <= 0) {
    return res.status(400).json({ success: false, message: "Invalid cart item or quantity" });
  }

  try {
    const [result] = await pool.execute(
      `UPDATE cart_detail cd
       JOIN cart c ON c.cart_id = cd.cart_id
       SET cd.quantity = ?
       WHERE cd.cart_detail_id = ? AND c.customer_id = ?`,
      [quantity, id, req.user.id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Cart item not found" });
    }

    return res.status(200).json({ success: true, message: "Cart item updated" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function DeleteCartItem(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ success: false, message: "Invalid cart item id" });
  }

  try {
    const [result] = await pool.execute(
      `DELETE cd FROM cart_detail cd
       JOIN cart c ON c.cart_id = cd.cart_id
       WHERE cd.cart_detail_id = ? AND c.customer_id = ?`,
      [id, req.user.id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Cart item not found" });
    }

    return res.status(200).json({ success: true, message: "Cart item deleted" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
