// Investment service — portfolio management, buy/sell, dividends, budget sync.
// All investments are funded exclusively from the Savings category.
import pool from '../database/db.js';
import { increaseBudget, decreaseBudget } from './userService.js';
import { getSavingsRemaining, deductFromSavings, creditToSavings } from './categoryService.js';

// ─── Table bootstrap ──────────────────────────────────────────────────────────

export const ensureTables = async () => {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS investments (
      id                 INT AUTO_INCREMENT PRIMARY KEY,
      user_id            INT            NOT NULL,
      name               VARCHAR(255)   NOT NULL,
      type               VARCHAR(100)   NOT NULL DEFAULT 'Other',
      invested_amount    DECIMAL(15,2)  NOT NULL DEFAULT 0,
      current_value      DECIMAL(15,2)  NOT NULL DEFAULT 0,
      quantity           DECIMAL(15,6)  DEFAULT NULL,
      avg_purchase_price DECIMAL(15,2)  DEFAULT NULL,
      status             ENUM('active','sold','closed') NOT NULL DEFAULT 'active',
      purchase_date      DATE           DEFAULT NULL,
      purchase_time      TIME           DEFAULT NULL,
      notes              TEXT           DEFAULT NULL,
      created_at         TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
      updated_at         TIMESTAMP      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS investment_transactions (
      id               INT AUTO_INCREMENT PRIMARY KEY,
      investment_id    INT            NOT NULL,
      user_id          INT            NOT NULL,
      type             ENUM('purchase','sale','dividend','interest','capital_gain','capital_loss') NOT NULL,
      amount           DECIMAL(15,2)  NOT NULL,
      quantity         DECIMAL(15,6)  DEFAULT NULL,
      price_per_unit   DECIMAL(15,2)  DEFAULT NULL,
      profit_loss      DECIMAL(15,2)  DEFAULT 0,
      transaction_date DATE           DEFAULT NULL,
      transaction_time TIME           DEFAULT NULL,
      notes            TEXT           DEFAULT NULL,
      created_at       TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (investment_id) REFERENCES investments(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id)       REFERENCES users(id)       ON DELETE CASCADE
    )
  `);
};

// ─── VALID TYPES ─────────────────────────────────────────────────────────────

export const INVESTMENT_TYPES = [
  'Stocks', 'Mutual Funds', 'ETFs', 'Cryptocurrency',
  'Gold', 'Silver', 'Savings Certificates',
  'Real Estate', 'Fixed Deposits', 'Bonds', 'Other',
];

export const normalizeType = (raw) => {
  if (!raw) return 'Other';
  const r = String(raw).trim().toLowerCase();
  const match = INVESTMENT_TYPES.find(t => t.toLowerCase() === r);
  if (match) return match;
  // Fuzzy matches
  if (r.includes('stock') || r.includes('share') || r.includes('equity')) return 'Stocks';
  if (r.includes('mutual') || r.includes('fund')) return 'Mutual Funds';
  if (r.includes('etf')) return 'ETFs';
  if (r.includes('crypto') || r.includes('bitcoin') || r.includes('eth') || r.includes('coin')) return 'Cryptocurrency';
  if (r.includes('gold')) return 'Gold';
  if (r.includes('silver')) return 'Silver';
  if (r.includes('bond')) return 'Bonds';
  if (r.includes('real estate') || r.includes('property') || r.includes('plot') || r.includes('land')) return 'Real Estate';
  if (r.includes('fd') || r.includes('fixed deposit') || r.includes('term deposit')) return 'Fixed Deposits';
  if (r.includes('certificate') || r.includes('saving cert') || r.includes('nsc')) return 'Savings Certificates';
  return 'Other';
};

// ─── BUY ─────────────────────────────────────────────────────────────────────

export const buyInvestment = async ({
  userId, name, type, amount, quantity = null,
  purchaseDate = null, purchaseTime = null, notes = null,
  skipSavingsCheck = false,   // true when called after a transfer has already been confirmed
}) => {
  await ensureTables();
  const investType = normalizeType(type || name);
  const amt = Number(amount);
  const qty = quantity ? Number(quantity) : null;
  const avgPrice = (qty && qty > 0) ? Number((amt / qty).toFixed(2)) : amt;

  // ── 1. Validate Savings ───────────────────────────────────────────────────
  if (!skipSavingsCheck) {
    const { remaining, category } = await getSavingsRemaining(userId);
    if (!category) {
      throw Object.assign(
        new Error('No Savings category found. Please add a Savings allocation to your budget.'),
        { code: 'NO_SAVINGS_CATEGORY' }
      );
    }
    if (remaining < amt) {
      throw Object.assign(
        new Error(`Insufficient savings`),
        {
          code: 'INSUFFICIENT_SAVINGS',
          available: remaining,
          required: amt,
          savingsCategory: category.category_name,
        }
      );
    }
  }

  // ── 2. Deduct from Savings ────────────────────────────────────────────────
  const { remaining: savingsAfter } = await deductFromSavings(userId, amt);

  // ── 3. Create / top-up investment record ─────────────────────────────────
  const [existing] = await pool.execute(
    `SELECT * FROM investments WHERE user_id = ? AND LOWER(name) = LOWER(?) AND status = 'active' LIMIT 1`,
    [userId, name]
  );

  let investment;
  if (existing.length > 0) {
    const prev = existing[0];
    const newInvested = Number(prev.invested_amount) + amt;
    const newQty = qty !== null ? (Number(prev.quantity || 0) + qty) : prev.quantity;
    const newAvgPrice = newQty ? Number((newInvested / newQty).toFixed(2)) : Number(prev.avg_purchase_price);
    await pool.execute(
      `UPDATE investments
         SET invested_amount = ?, current_value = ?, quantity = ?, avg_purchase_price = ?, updated_at = NOW()
       WHERE id = ?`,
      [newInvested, newInvested, newQty, newAvgPrice, prev.id]
    );
    const [[updated]] = await pool.execute('SELECT * FROM investments WHERE id = ?', [prev.id]);
    investment = updated;
  } else {
    const [result] = await pool.execute(
      `INSERT INTO investments
         (user_id, name, type, invested_amount, current_value, quantity, avg_purchase_price, status, purchase_date, purchase_time, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
      [userId, name, investType, amt, amt, qty, avgPrice, purchaseDate, purchaseTime, notes]
    );
    const [[created]] = await pool.execute('SELECT * FROM investments WHERE id = ?', [result.insertId]);
    investment = created;
  }

  // ── 4. Log transaction ────────────────────────────────────────────────────
  await pool.execute(
    `INSERT INTO investment_transactions
       (investment_id, user_id, type, amount, quantity, price_per_unit, profit_loss, transaction_date, transaction_time, notes)
     VALUES (?, ?, 'purchase', ?, ?, ?, 0, ?, ?, ?)`,
    [investment.id, userId, amt, qty, avgPrice, purchaseDate, purchaseTime, notes]
  );

  // ── 5. Reduce available balance ───────────────────────────────────────────
  const newBudget = await decreaseBudget(userId, amt);

  return { investment, newBudget, savingsAfter };
};

// ─── SELL ─────────────────────────────────────────────────────────────────────

export const sellInvestment = async ({
  investmentId, userId, saleAmount, saleQuantity = null,
  saleDate = null, saleTime = null, notes = null,
}) => {
  await ensureTables();
  const [[inv]] = await pool.execute('SELECT * FROM investments WHERE id = ? AND user_id = ?', [investmentId, userId]);
  if (!inv) throw new Error('Investment not found.');
  if (inv.status !== 'active') throw new Error('Investment is already sold/closed.');

  const saleAmt = Number(saleAmount);
  const totalInvested = Number(inv.invested_amount);
  const totalQty = Number(inv.quantity || 0);

  // Determine how much of the position is being sold
  let soldQty = saleQuantity ? Number(saleQuantity) : null;
  let costBasis;
  let isFullSale;

  if (soldQty && totalQty > 0) {
    const fraction = Math.min(soldQty / totalQty, 1);
    isFullSale = fraction >= 0.999;
    costBasis = totalInvested * fraction;
  } else {
    // No quantity info — treat as full sale
    isFullSale = true;
    soldQty = totalQty || null;
    costBasis = totalInvested;
  }

  const profitLoss = Number((saleAmt - costBasis).toFixed(2));
  const txType = profitLoss >= 0 ? 'sale' : 'sale';

  if (isFullSale) {
    await pool.execute(
      `UPDATE investments SET status = 'sold', current_value = ?, updated_at = NOW() WHERE id = ?`,
      [saleAmt, investmentId]
    );
  } else {
    const remainQty = totalQty - soldQty;
    const remainCost = totalInvested - costBasis;
    await pool.execute(
      `UPDATE investments
         SET invested_amount = ?, current_value = ?, quantity = ?, updated_at = NOW()
       WHERE id = ?`,
      [remainCost, remainCost, remainQty, investmentId]
    );
  }

  await pool.execute(
    `INSERT INTO investment_transactions
       (investment_id, user_id, type, amount, quantity, price_per_unit, profit_loss, transaction_date, transaction_time, notes)
     VALUES (?, ?, 'sale', ?, ?, ?, ?, ?, ?, ?)`,
    [investmentId, userId, saleAmt, soldQty,
     soldQty ? Number((saleAmt / soldQty).toFixed(2)) : null,
     profitLoss, saleDate, saleTime, notes]
  );

  // Return cash to available balance AND credit back into Savings
  const newBudget = await increaseBudget(userId, saleAmt);
  const savingsResult = await creditToSavings(userId, saleAmt);
  const savingsAfter = savingsResult?.remaining ?? null;

  const [[updated]] = await pool.execute('SELECT * FROM investments WHERE id = ?', [investmentId]);
  return { investment: updated, profitLoss, newBudget, isFullSale, costBasis, savingsAfter };
};

// ─── DIVIDEND / INTEREST ─────────────────────────────────────────────────────

export const addDividend = async ({
  userId, investmentId = null, investmentName = null,
  amount, type = 'dividend',
  txDate = null, txTime = null, notes = null,
}) => {
  await ensureTables();
  const amt = Number(amount);

  // Resolve investmentId from name if not provided
  let invId = investmentId;
  if (!invId && investmentName) {
    const [rows] = await pool.execute(
      `SELECT id FROM investments WHERE user_id = ? AND LOWER(name) = LOWER(?) AND status = 'active' LIMIT 1`,
      [userId, investmentName]
    );
    if (rows.length > 0) invId = rows[0].id;
  }

  // If still no match, use a generic placeholder investment
  if (!invId) {
    const [rows] = await pool.execute(
      `SELECT id FROM investments WHERE user_id = ? AND name = 'Dividends & Returns' LIMIT 1`,
      [userId]
    );
    if (rows.length > 0) {
      invId = rows[0].id;
    } else {
      const [res] = await pool.execute(
        `INSERT INTO investments (user_id, name, type, invested_amount, current_value, status) VALUES (?, 'Dividends & Returns', 'Other', 0, 0, 'active')`,
        [userId]
      );
      invId = res.insertId;
    }
  }

  const txTypeNorm = ['dividend', 'interest', 'capital_gain', 'capital_loss'].includes(type) ? type : 'dividend';

  await pool.execute(
    `INSERT INTO investment_transactions
       (investment_id, user_id, type, amount, profit_loss, transaction_date, transaction_time, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [invId, userId, txTypeNorm, amt, amt, txDate, txTime, notes]
  );

  // Dividends increase available balance
  const newBudget = await increaseBudget(userId, amt);

  return { newBudget, amount: amt };
};

// ─── QUERIES ─────────────────────────────────────────────────────────────────

export const getPortfolio = async (userId) => {
  await ensureTables();
  const [rows] = await pool.execute(
    `SELECT * FROM investments WHERE user_id = ? ORDER BY created_at DESC`,
    [userId]
  );
  return rows.map(r => ({
    ...r,
    invested_amount: Number(r.invested_amount),
    current_value: Number(r.current_value),
    quantity: r.quantity !== null ? Number(r.quantity) : null,
    avg_purchase_price: r.avg_purchase_price !== null ? Number(r.avg_purchase_price) : null,
    profit_loss: Number(r.current_value) - Number(r.invested_amount),
    return_pct: Number(r.invested_amount) > 0
      ? Number((((Number(r.current_value) - Number(r.invested_amount)) / Number(r.invested_amount)) * 100).toFixed(2))
      : 0,
  }));
};

export const getInvestmentById = async (id, userId) => {
  await ensureTables();
  const [[row]] = await pool.execute(
    'SELECT * FROM investments WHERE id = ? AND user_id = ?',
    [id, userId]
  );
  return row || null;
};

export const findActiveByName = async (userId, name) => {
  await ensureTables();
  const [rows] = await pool.execute(
    `SELECT * FROM investments WHERE user_id = ? AND LOWER(name) = LOWER(?) AND status = 'active' LIMIT 1`,
    [userId, name]
  );
  return rows[0] || null;
};

export const getInvestmentTransactions = async (userId) => {
  await ensureTables();
  const [rows] = await pool.execute(
    `SELECT it.*, i.name AS investment_name, i.type AS investment_type
       FROM investment_transactions it
       JOIN investments i ON it.investment_id = i.id
      WHERE it.user_id = ?
      ORDER BY COALESCE(it.transaction_date, it.created_at) DESC, it.created_at DESC`,
    [userId]
  );
  return rows.map(r => ({ ...r, amount: Number(r.amount), profit_loss: Number(r.profit_loss) }));
};

export const getInvestmentSummary = async (userId) => {
  await ensureTables();

  const [[activeRow]] = await pool.execute(
    `SELECT
       COUNT(*) AS count,
       COALESCE(SUM(invested_amount), 0) AS total_invested,
       COALESCE(SUM(current_value),   0) AS total_current_value
     FROM investments WHERE user_id = ? AND status = 'active'`,
    [userId]
  );

  const [[soldRow]] = await pool.execute(
    `SELECT COALESCE(SUM(current_value), 0) AS total_sold_value,
            COALESCE(SUM(invested_amount), 0) AS total_sold_cost
     FROM investments WHERE user_id = ? AND status = 'sold'`,
    [userId]
  );

  // Realized P&L from sale transactions
  let realizedPL = 0;
  let dividends = 0;
  try {
    const [[plRow]] = await pool.execute(
      `SELECT
         COALESCE(SUM(CASE WHEN type = 'sale' THEN profit_loss ELSE 0 END), 0) AS realized,
         COALESCE(SUM(CASE WHEN type IN ('dividend','interest') THEN amount ELSE 0 END), 0) AS dividends
       FROM investment_transactions WHERE user_id = ?`,
      [userId]
    );
    realizedPL = Number(plRow.realized);
    dividends = Number(plRow.dividends);
  } catch { /* ignore */ }

  const totalInvested = Number(activeRow.total_invested);
  const totalCurrentValue = Number(activeRow.total_current_value);
  const unrealizedGL = totalCurrentValue - totalInvested;
  const totalReturn = totalInvested > 0 ? Number(((unrealizedGL / totalInvested) * 100).toFixed(2)) : 0;

  return {
    activeCount: Number(activeRow.count),
    totalInvested,
    totalCurrentValue,
    unrealizedGL,
    totalReturn,
    realizedPL,
    dividends,
    totalPL: unrealizedGL + realizedPL,
  };
};
