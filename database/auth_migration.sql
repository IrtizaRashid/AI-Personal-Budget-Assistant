-- ============================================================
--  Authentication Migration - Add email and password to users
-- ============================================================
--  This script adds authentication fields to the existing users table
--  Run this after the base schema.sql
-- ============================================================

-- Add email column (must be unique)
ALTER TABLE users 
ADD COLUMN email VARCHAR(255) UNIQUE NOT NULL AFTER name;

-- Add password_hash column for bcrypt hashed passwords
ALTER TABLE users 
ADD COLUMN password_hash VARCHAR(255) NOT NULL AFTER email;

-- Add updated_at timestamp
ALTER TABLE users 
ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;

-- Create index on email for faster lookups
CREATE INDEX idx_users_email ON users(email);
