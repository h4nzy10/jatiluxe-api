 import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host                : 'localhost',
  user                : 'root',
  database            : 'jatiluxe_local',
  waitForConnections  : true
});

export default pool;