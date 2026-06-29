// Authentication controller - handles registration, login, logout, and user verification
import { asyncHandler } from '../middleware/asyncHandler.js';
import * as authService from '../services/authService.js';

// POST /api/auth/register
// Register a new user
export const register = asyncHandler(async (req, res) => {
  const { full_name, email, password, confirm_password, monthly_budget } = req.body;

  // Validation
  if (!full_name || !email || !password || !confirm_password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  if (password !== confirm_password) {
    return res.status(400).json({ error: 'Passwords do not match' });
  }

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  try {
    const user = await authService.registerUser({
      full_name,
      email,
      password,
      monthly_budget: monthly_budget || 0,
    });

    res.status(201).json({
      message: 'Registration successful',
      user,
    });
  } catch (error) {
    if (error.code === 'EMAIL_EXISTS') {
      return res.status(409).json({ error: error.message });
    }
    throw error;
  }
});

// POST /api/auth/login
// Login user
export const login = asyncHandler(async (req, res) => {
  const { email, password, rememberMe } = req.body;

  // Validation
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const result = await authService.loginUser({
      email,
      password,
      rememberMe: rememberMe || false,
    });

    res.status(200).json({
      message: 'Login successful',
      user: result.user,
      token: result.token,
    });
  } catch (error) {
    if (error.code === 'INVALID_CREDENTIALS') {
      return res.status(401).json({ error: error.message });
    }
    throw error;
  }
});

// POST /api/auth/logout
// Logout user (client-side token removal)
export const logout = asyncHandler(async (req, res) => {
  // In a JWT-based system, logout is handled on the client side by removing the token
  // This endpoint is mainly for consistency and future session management
  res.status(200).json({ message: 'Logout successful' });
});

// GET /api/auth/me
// Get current user info
export const getCurrentUser = asyncHandler(async (req, res) => {
  // req.user is set by authMiddleware
  const userId = req.user.userId;

  const user = await authService.getUserById(userId);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.status(200).json({ user });
});
