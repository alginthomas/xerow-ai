/**
 * Authentication Middleware
 * JWT token verification
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../database/connection.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
  userPersona?: string;
  userName?: string;
}

/**
 * Verify JWT token and attach user info to request
 */
export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No authorization token provided' });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
      
      // Verify user still exists in database
      const result = await query(
        'SELECT id, email, name, role, persona FROM users WHERE id = $1',
        [decoded.userId]
      );

      if (result.rows.length === 0) {
        res.status(401).json({ error: 'User not found' });
        return;
      }

      const user = result.rows[0];
      req.userId = user.id;
      req.userRole = user.role;
      req.userPersona = user.persona;
      req.userName = user.name;
      
      next();
    } catch (error) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication error' });
    return;
  }
}

/**
 * Check if user has required role
 */
export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.userRole) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    if (!roles.includes(req.userRole)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}

/**
 * Check if user has required persona (tom/dick/harry)
 */
export function requirePersona(...personas: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.userPersona) {
      res.status(403).json({ error: 'User persona not set' });
      return;
    }

    if (!personas.includes(req.userPersona)) {
      res.status(403).json({ error: 'Insufficient permissions for this persona' });
      return;
    }

    next();
  };
}

/**
 * Generate JWT token
 */
export function generateToken(userId: string, email: string): string {
  return jwt.sign(
    { userId, email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}
