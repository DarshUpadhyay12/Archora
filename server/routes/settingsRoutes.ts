import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware';
import { settingsRepository } from '../repositories/settingsRepository';

export const settingsRouter = Router();

settingsRouter.use(requireAuth);

// GET /api/settings
settingsRouter.get('/', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const settings = settingsRepository.get(userId);
    return res.json({ settings });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch settings.' });
  }
});

// PUT /api/settings
settingsRouter.put('/', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const settings = settingsRepository.upsert(userId, req.body);
    return res.json({ settings });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to update settings.' });
  }
});

