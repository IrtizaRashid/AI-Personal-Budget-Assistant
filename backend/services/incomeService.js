import pool from '../database/db.js';

// Create table on first use; idempotently add received_time if missing.
const ensureTable = async () => {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS income (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      user_id       INT NOT NULL,
      amount        DECIMAL(12,2) NOT NULL,
      source        VARCHAR(100)  DEFAULT NULL,
      description   VARCHAR(255)  DEFAULT NULL,
      recurring     TINYINT(1)    DEFAULT 0,
      received_date DATE          NOT NULL,
      received_time TIME          DEFAULT NULL,
      created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  // Add columns that may not exist on older rows (idempotent).
  for (const ddl of [
    `ALTER TABLE income ADD COLUMN received_time TIME DEFAULT NULL`,
    `ALTER TABLE income ADD COLUMN recurring TINYINT(1) DEFAULT 0`,
  ]) {
    try { await pool.execute(ddl); } catch (e) { if (e.errno !== 1060) throw e; }
  }
};

export const addIncome = async ({
  userId, amount, source = null, description = null,
  receivedDate = null, receivedTime = null, recurring = false,
}) => {
  await ensureTable();
  const date = receivedDate || new Date().toISOString().split('T')[0];
  const [result] = await pool.execute(
    `INSERT INTO income (user_id, amount, source, description, recurring, received_date, received_time)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId, amount, source, description, recurring ? 1 : 0, date, receivedTime || null]
  );
  const [rows] = await pool.execute(
    `SELECT id, user_id, amount, source, description, recurring, received_date, received_time, created_at
       FROM income WHERE id = ?`,
    [result.insertId]
  );
  return rows[0];
};

export const getIncomeByUser = async (userId) => {
  await ensureTable();
  const [rows] = await pool.execute(
    `SELECT id, user_id, amount, source, description, recurring, received_date, received_time, created_at
       FROM income
      WHERE user_id = ?
      ORDER BY received_date DESC, received_time DESC, created_at DESC`,
    [userId]
  );
  return rows;
};

export const deleteIncomeById = async (incomeId) => {
  await ensureTable();
  const [result] = await pool.execute(
    `DELETE FROM income WHERE id = ?`,
    [incomeId]
  );
  return result.affectedRows > 0;
};
