// Authentication service layer - handles user registration, login, and token management
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../database/db.js';

const SALT_ROUNDS = 10;

// Generate JWT token
const generateToken = (userId, rememberMe = false) => {
  const expiresIn = rememberMe ? '30d' : '1d';
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'your-secret-key', {
    expiresIn,
  });
};

// Register a new user
export const registerUser = async ({ full_name, email, password, monthly_budget = 0 }) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Check if email already exists
    const [existingUsers] = await connection.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );
    if (existingUsers.length > 0) {
      const error = new Error('Email already exists');
      error.code = 'EMAIL_EXISTS';
      throw error;
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    // Insert new user
    const [result] = await connection.execute(
      'INSERT INTO users (name, email, password_hash, monthly_budget) VALUES (?, ?, ?, ?)',
      [full_name, email, password_hash, monthly_budget]
    );

    await connection.commit();

    // Return the created user without password
    const [rows] = await connection.execute(
      'SELECT id, name, email, monthly_budget, created_at FROM users WHERE id = ?',
      [result.insertId]
    );
    return rows[0];
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

// Login user
export const loginUser = async ({ email, password, rememberMe = false }) => {
  const connection = await pool.getConnection();
  try {
    // Find user by email
    const [rows] = await connection.execute(
      'SELECT id, name, email, password_hash, monthly_budget FROM users WHERE email = ?',
      [email]
    );
    const user = rows[0];

    if (!user) {
      const error = new Error('Invalid credentials');
      error.code = 'INVALID_CREDENTIALS';
      throw error;
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      const error = new Error('Invalid credentials');
      error.code = 'INVALID_CREDENTIALS';
      throw error;
    }

    // Generate token
    const token = generateToken(user.id, rememberMe);

    // Return user data without password hash
    const { password_hash, ...userWithoutPassword } = user;
    return {
      user: userWithoutPassword,
      token,
    };
  } catch (error) {
    throw error;
  } finally {
    connection.release();
  }
};

// Get user by ID
export const getUserById = async (userId) => {
  const [rows] = await pool.execute(
    'SELECT id, name, email, monthly_budget, created_at, updated_at FROM users WHERE id = ?',
    [userId]
  );
  return rows[0];
};

// Verify JWT token
export const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    return decoded;
  } catch (error) {
    return null;
  }
};
