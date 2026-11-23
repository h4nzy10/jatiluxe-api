import { generateAccessToken } from "../helper/token";

export async function Login(req, res) {
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
}

export async function Register(req, res) {
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
    res.status(201).json({
      message: "Register success! You can login",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Terjadi kesalahan server", error });
  }
}

export async function RegisterAsSeller(req, res) {
  try {
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
    res.status(201).json({
      message: "Register success! You can login",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Server error", error });
  }
}
