import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService';
import { SafeUser } from '../types/db';

export interface AuthenticatedRequest extends Request {
  user?: SafeUser;
  token?: string;
}

/**
 * Extracts session token from Authorization header (Bearer <token>)
 * or custom header x-auth-token.
 */
export function extractToken(req: Request): string | null {
  const authHeader = req.headers['authorization'];
  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  const customHeader = req.headers['x-auth-token'];
  if (customHeader && typeof customHeader === 'string') {
    return customHeader.trim();
  }
  if (req.query && typeof req.query.token === 'string') {
    return req.query.token.trim();
  }
  return null;
}

/**
 * Strict authentication middleware: Rejects request if not signed in.
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({
      error: 'Authentication required. Please sign in to your Archora studio account.',
    });
  }

  const user = authService.validateSession(token);
  if (!user) {
    return res.status(401).json({
      error: 'Session expired or invalid. Please sign in again.',
    });
  }

  req.user = user;
  req.token = token;
  next();
}

/**
 * Optional authentication middleware: Attaches user if valid session exists, but allows guest/anonymous if not.
 */
export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (token) {
    const user = authService.validateSession(token);
    if (user) {
      req.user = user;
      req.token = token;
    }
  }
  next();
}

