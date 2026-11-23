export function sellerMiddleware(req, res, next) {
  if (req.user?.role !== "seller") {
    return res.status(403).json({
      message: "Access denied, you are not a seller!",
    });
  }
  next()
}
