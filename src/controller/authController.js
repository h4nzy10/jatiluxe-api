import { generateAccessToken } from "../helper/token.js";
import pool from "../config/config.js"

const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_MS = 30 * 1000; // 30 seconds cooldown after 5 failures

// In-memory per IP + email tracker. Use a shared store (Redis/DB) for
// multi-instance deployments such as serverless.
const loginAttempts = new Map();

function loginAttemptKey(req, email) {
  const forwarded = req.headers["x-forwarded-for"]?.split(",")[0]?.trim();
  const ip = forwarded || req.ip || req.socket?.remoteAddress || "unknown";
  return `${ip}:${String(email ?? "").trim().toLowerCase()}`;
}

function lockMessage(seconds) {
  return `Terlalu banyak percobaan login gagal. Coba lagi dalam ${seconds} detik.`;
}

export async function Login(req, res) {
  try {
    const { email, password } = req.body;
    const key = loginAttemptKey(req, email);
    const now = Date.now();
    const attempt = loginAttempts.get(key) ?? { count: 0, lockedUntil: 0 };

    if (attempt.lockedUntil > now) {
      const seconds = Math.ceil((attempt.lockedUntil - now) / 1000);
      return res.status(429).json({
        message: lockMessage(seconds),
        retry_after: seconds,
      });
    }

    // Cooldown already elapsed: start a fresh window.
    if (attempt.lockedUntil !== 0) {
      attempt.count = 0;
      attempt.lockedUntil = 0;
    }

    const [user] = await pool.query(
      "SELECT * FROM users WHERE email = ? AND password = ?;",
      [email, password],
    );

    if (!user.length) {
      attempt.count += 1;

      if (attempt.count >= MAX_LOGIN_ATTEMPTS) {
        attempt.lockedUntil = now + LOGIN_LOCK_MS;
        loginAttempts.set(key, attempt);
        const seconds = Math.ceil(LOGIN_LOCK_MS / 1000);
        return res.status(429).json({
          message: lockMessage(seconds),
          retry_after: seconds,
        });
      }

      loginAttempts.set(key, attempt);
      return res.status(400).json({
        message: "Email atau kata sandi salah.",
        remaining_attempts: MAX_LOGIN_ATTEMPTS - attempt.count,
      });
    }

    // Successful login clears the failure history for this key.
    loginAttempts.delete(key);

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
    const { nama, email, password, no_hp, alamat } = req.body;
    const [rows] = await pool.execute(
      "INSERT INTO users (nama, email, password, no_hp, alamat) VALUES (?, ?, ?, ?, ?)",
      [
        nama,
        email,
        password,
        no_hp,
        alamat,
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
    const { nama, email, password, no_hp, alamat } = req.body;
    const [seller] = await pool.query(
      "INSERT INTO users (nama, email, password, role, no_hp, alamat) VALUES (?, ?, ?, 2, ?, ?)",
      [
        nama,
        email,
        password,
        no_hp,
        alamat,
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

export async function UpgradeToSeller(req, res) {
  try {
    const { email, password } = req.body;
    const [rows] = await pool.query(
      "SELECT id_user, nama, email, password, role, no_hp, alamat, profile FROM users WHERE email = ? AND password = ?",
      [email, password],
    );

    if (!rows.length) {
      return res.status(400).json({ message: "Email atau kata sandi salah." });
    }

    const user = rows[0];
    if (Number(user.id_user) !== Number(req.user.id)) {
      return res.status(403).json({
        message: "Akun yang dibuka tidak sama dengan akun yang sedang login.",
      });
    }

    const role = String(user.role ?? "").toLowerCase();
    if (role === "2" || role === "seller") {
      return res.status(409).json({ message: "Akun ini sudah menjadi penjual." });
    }

    await pool.execute("UPDATE users SET role = 2 WHERE id_user = ?", [
      user.id_user,
    ]);

    const token = generateAccessToken({ ...user, role: 2 });
    return res.status(200).json({
      message: "Akun berhasil ditingkatkan menjadi penjual",
      token,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error", error });
  }
}
