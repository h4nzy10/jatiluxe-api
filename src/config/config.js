 import "dotenv/config";
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host                : process.env.HOST,
  port                : process.env.PORT,
  user                : process.env.USER,
  password            : process.env.PASSWORD,
  database            : process.env.DB,
});

export default pool;