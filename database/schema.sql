-- ============================================================
--  AI Personal Budget Assistant — Database Schema (with Auth)
-- ============================================================
--  Local MySQL:
--    CREATE DATABASE budget_ai;
--    mysql -u root -p budget_ai < schema.sql
--
--  Railway:
--    Paste into the Railway database "Query" tab.
-- ============================================================

-- ------------------------------------------------------------
--  Table 1: users  (includes auth fields)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id              INT             NOT NULL AUTO_INCREMENT,
  name            VARCHAR(255)    NOT NULL,
  email           VARCHAR(255)    NOT NULL UNIQUE,
  password_hash   VARCHAR(255)    NOT NULL,
  monthly_budget  DECIMAL(12, 2)  NOT NULL DEFAULT 0.00,
  created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_users_email (email)
) ENGINE = InnoDB;

-- ------------------------------------------------------------
--  Table 2: budget_categories
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS budget_categories (
  id               INT            NOT NULL AUTO_INCREMENT,
  user_id          INT            NOT NULL,
  category_name    VARCHAR(255)   NOT NULL,
  allocated_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  spent_amount     DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (id),
  CONSTRAINT fk_categories_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  INDEX idx_categories_user (user_id)
) ENGINE = InnoDB;

-- ------------------------------------------------------------
--  Table 3: expenses
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expenses (
  id           INT            NOT NULL AUTO_INCREMENT,
  user_id      INT            NOT NULL,
  category     VARCHAR(255)   NOT NULL,
  amount       DECIMAL(12, 2) NOT NULL,
  description  VARCHAR(255)   NULL,
  expense_date DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_expenses_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  INDEX idx_expenses_user (user_id),
  INDEX idx_expenses_date (expense_date),
  INDEX idx_expenses_user_category (user_id, category)
) ENGINE = InnoDB;
