// MySQL connection pool.
//
// A pool (rather than a single connection) is used so the app can serve
// many concurrent requests efficiently. Credentials come entirely from
// environment variables via config/env.js — no secrets are hard-coded.
//
// NOTE (Step 1): no tables are created or queried yet. This file simply
// establishes a reusable, env-driven connection that later steps will use.
import mysql from 'mysql2/promise';
import { config } from '../config/env.js';

const pool = mysql.createPool({
  host: config.db.host,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Optional, non-fatal connectivity check at startup.
// The server still runs even if MySQL is not available yet,
// so you can build the frontend before configuring the database.
export const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    console.log('✅ MySQL connected');
  } catch (error) {
    console.warn('⚠️  MySQL not connected:', error.message);
  }
};

export default pool;
