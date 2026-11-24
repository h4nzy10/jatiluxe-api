export function sellerMiddleware(req, res, next) {
  const role = req.user?.role?.toString().toLowerCase();
  if (role !== "seller" && role !== "2") {
    return res.status(403).json({
      message: "Access denied, you are not a seller!",
    });
  }
  next();
}
