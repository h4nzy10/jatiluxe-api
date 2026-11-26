import express from "express";
import cors from "cors";
import "dotenv/config";
import { verifyToken } from "./middleware/Auth.js";
import { uploadprofile, uploadProduct, uploadDeliveryProof } from "./middleware/Cloudinary.js";
import { Schema, validate } from "./validator/Validator.js";
import { Login, Register, RegisterAsSeller } from "./controller/authController.js";
import { AddProfile, EditProfile, GetProfile } from "./controller/UserProfileController.js";
import { AddProduct, DeleteProduct, EditProduct, GetAProduct, GetCategories, GetProducts, GetSellerProducts } from "./controller/productController.js";
import { AddToCart, DeleteCartItem, GetCartList, UpdateCartItem } from "./controller/cartController.js";
import { CancelOrder, CreateOrder, CreateOrderFromCart, GetOrderById, GetOrders } from "./controller/orderController.js";
import { CancelPayment, GetSales, GetTransactionDetail, Payment } from "./controller/paymentController.js";
import { sellerMiddleware } from "./middleware/sellerMiddleware.js";
import { ConfirmDelivery, FinishDeliveryApply, GetDeliveryApply, GetDeliveryTracking, GetDeliveryTrackingByOrder, GetSellerDeliveries, UpdateDeliveryStatus } from "./controller/deliveryController.js";

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
app.post("/api/v1/profile-picture", verifyToken, uploadprofile.single("profile"), AddProfile);

// Get A Profile
app.get("/api/v1/profile", verifyToken, GetProfile);

// Update Profile
app.put("/api/v1/profile", verifyToken, uploadprofile.single("profile"), validate(Schema.editProfile), EditProfile);

//  ========================= Product =========================

// Get All Categories
app.get("/api/v1/categories", verifyToken, GetCategories);

// Get All Product
app.get("/api/v1/products", verifyToken, GetProducts);

// Get Seller's Products
app.get("/api/v1/seller-products", verifyToken, sellerMiddleware, GetSellerProducts)

// Get A Specific Product
app.get("/api/v1/product/:id", verifyToken, GetAProduct);

// Add New product
app.post("/api/v1/product", verifyToken, sellerMiddleware, uploadProduct.single("picture"), validate(Schema.product), AddProduct);

// Edit A Product
app.put("/api/v1/product/:id", verifyToken, sellerMiddleware, uploadProduct.single("picture"), validate(Schema.product), EditProduct);

// Delete A Product
app.delete("/api/v1/product/:id", verifyToken, sellerMiddleware, DeleteProduct);

//  ========================= Cart =========================

// Add Product To Cart
app.post("/api/v1/cart", verifyToken, AddToCart);

// Get Cart List
app.get("/api/v1/cart-list", verifyToken, GetCartList);

// Update Cart Item
app.put("/api/v1/cart/:id", verifyToken, UpdateCartItem);

// Delete Cart Item
app.delete("/api/v1/cart/:id", verifyToken, DeleteCartItem);

//  ========================= Order =========================

// Order A Product
app.post("/api/v1/order", verifyToken, CreateOrder);

// Make Order From Cart
app.post("/api/v1/order/partial", verifyToken, CreateOrderFromCart);

// Cancel Order
app.put("/api/v1/order/:id/cancel", verifyToken, CancelOrder);

// Get Orders
app.get("/api/v1/orders", verifyToken, GetOrders);

// Get Order Detail
app.get("/api/v1/orders/:id", verifyToken, GetOrderById);

//  ========================= Transaction =========================
// Doing Transaction
app.put("/api/v1/payments", verifyToken, Payment);

// Cancel The Transaction
app.put("/api/v1/payments/:id/cancel", verifyToken, CancelPayment);

// Get Transaction Detail
app.get("/api/v1/payments/:id", verifyToken, GetTransactionDetail);

// Get Sales
app.get("/api/v1/sales", verifyToken, sellerMiddleware, GetSales);

//  ========================= Delivery =========================

// Get Seller Deliveries (seller's own orders)
app.get("/api/v1/seller-deliveries", verifyToken, sellerMiddleware, GetSellerDeliveries);

// Tracking All Delivery From Customer
app.get("/api/v1/order-tracking", verifyToken, GetDeliveryTracking);

// Tracking Delivery From Customer By Order
app.get("/api/v1/order-tracking/:id", verifyToken, GetDeliveryTrackingByOrder);

// Update Delivery Status
app.put("/api/v1/delivery/:id/status", verifyToken, sellerMiddleware, UpdateDeliveryStatus);

// Confirm Delivery Received
app.post("/api/v1/delivery/:id/confirm", verifyToken, uploadDeliveryProof.single("proof"), ConfirmDelivery);

// Get Delivery Apply (seller)
app.get("/api/v1/delivery-apply/:id", verifyToken, sellerMiddleware, GetDeliveryApply);

// Finish Delivery Apply (seller)
app.put("/api/v1/delivery-apply/:id/finish", verifyToken, sellerMiddleware, FinishDeliveryApply);

app.listen(3000, () => {
  console.log(`JatiLuxe activated on port 3000`);
});