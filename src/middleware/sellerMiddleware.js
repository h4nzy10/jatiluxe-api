export function sellerMiddleware(req, res, next) {
  if (req.user?.role !== "seller" || req.user?.role !== "2" || req.user?.role !== 2) {
    return res.status(401).json({
      message: "Access denied, you are not a seller!",
    });
  }
  next()
}
