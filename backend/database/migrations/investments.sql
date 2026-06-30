-- Investment Management Tables
-- Run once to add investment support to the database.

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
);

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
);
