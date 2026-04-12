/**
 * Authentication Routes
 * Sign up, sign in, token refresh
 */

import express from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../database/connection.js';
import { generateToken, authenticate, AuthRequest } from '../middleware/auth.js';
import { z } from 'zod';

const router = express.Router();

// Validation schemas
const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  role: z.enum(['customer', 'seller', 'admin']).default('customer'),
  persona: z.enum(['tom', 'dick', 'harry']).optional()
});

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

/**
 * POST /api/auth/signup
 * Create a new user account
 */
router.post('/signup', async (req, res) => {
  try {
    const { email, password, name, role = 'customer', persona } = signUpSchema.parse(req.body);

    // Check if user already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const result = await query(
      `INSERT INTO users (email, password_hash, name, role, persona)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, name, role, persona, created_at`,
      [email, passwordHash, name, role, persona || null]
    );

    const user = result.rows[0];

    // Generate token
    const token = generateToken(user.id, user.email);

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        persona: user.persona
      },
      token
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

/**
 * POST /api/auth/signin
 * Sign in with email and password
 */
router.post('/signin', async (req, res) => {
  try {
    const { email, password } = signInSchema.parse(req.body);

    // Find user
    const result = await query(
      'SELECT id, email, password_hash, name, role, persona FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate token
    const token = generateToken(user.id, user.email);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        persona: user.persona
      },
      token
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Signin error:', error);
    res.status(500).json({ error: 'Failed to sign in' });
  }
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    const result = await query(
      'SELECT id, email, name, role, persona, created_at FROM users WHERE id = $1',
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

export { router as authRoutes };
