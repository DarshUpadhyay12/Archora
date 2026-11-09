import { Router, Response } from 'express';
import { authService } from '../services/authService';
import { requireAuth, AuthenticatedRequest, extractToken } from '../middleware/authMiddleware';
import { authRateLimiter } from '../middleware/rateLimiter';

export const authRouter = Router();

// POST /api/auth/register
authRouter.post('/register', authRateLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, password, fullName, university, semester, bio } = req.body || {};

    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Valid email and password strings are required.' });
    }

    const result = await authService.register({
      email,
      password,
      fullName: typeof fullName === 'string' ? fullName : '',
      university: typeof university === 'string' ? university : undefined,
      semester: typeof semester === 'string' ? semester : undefined,
      bio: typeof bio === 'string' ? bio : undefined,
    });
    return res.status(201).json(result);
  } catch (err: any) {
    const status = err.message.includes('already registered') ? 409 : 400;
    return res.status(status).json({ error: err.message || 'Registration failed.' });
  }
});

// POST /api/auth/login
authRouter.post('/login', authRateLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, password } = req.body || {};

    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Valid email and password strings are required.' });
    }

    const result = await authService.login(email, password);
    return res.json(result);
  } catch (err: any) {
    const status = err.message.includes('Invalid email or password') ? 401 : 400;
    return res.status(status).json({ error: err.message || 'Login failed.' });
  }
});

// POST /api/auth/logout
authRouter.post('/logout', (req: AuthenticatedRequest, res: Response) => {
  const token = extractToken(req);
  if (token) {
    authService.logout(token);
  }
  return res.json({ success: true, message: 'Logged out successfully.' });
});

// GET /api/auth/me
authRouter.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  return res.json({ user: req.user });
});
