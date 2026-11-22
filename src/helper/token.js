import jwt from "jsonwebtoken";
import "dotenv/config";

export const JWT_SECRET = process.env.JWT_SECRET || "com.jatiluxe.secret";

export const generateAccessToken = (params) => {
  return jwt.sign(
    {
      id: params.id_user,
      name: params.nama,
      email: params.email,
      password: params.password,
      role: params.role,
      phone: params.no_hp,
      address: params.alamat,
      profile: params.profile,
    },
    JWT_SECRET,
    { expiresIn: "2d" },
  );
};
