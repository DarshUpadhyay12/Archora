import { Router, Response } from 'express';
import crypto from 'crypto';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware';
import { savedOutputRepository } from '../repositories/savedOutputRepository';

export const savedOutputRouter = Router();

savedOutputRouter.use(requireAuth);

// GET /api/saved-outputs - List saved outputs with search, filter, and sort
savedOutputRouter.get('/', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { type, projectId, search, sortBy, limit, offset } = req.query;

    const outputs = savedOutputRepository.findByUser(userId, {
      type: typeof type === 'string' ? type : undefined,
      projectId: typeof projectId === 'string' ? projectId : undefined,
      search: typeof search === 'string' ? search : undefined,
      sortBy: sortBy === 'oldest' ? 'oldest' : 'newest',
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    });

    return res.json({ outputs, count: outputs.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch saved outputs.' });
  }
});

// POST /api/saved-outputs - Save an AI output
savedOutputRouter.post('/', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { projectId, type, title, content, metadata } = req.body;

    if (!type || !title || !title.trim() || !content) {
      return res.status(400).json({ error: 'Type, title, and content are required.' });
    }

    const outputId = `out_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const output = savedOutputRepository.create({
      id: outputId,
      user_id: userId,
      project_id: projectId || null,
      type,
      title: title.trim(),
      content,
      metadata,
    });

    return res.status(201).json({ output });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to save output.' });
  }
});

// GET /api/saved-outputs/:id - Get an individual output
savedOutputRouter.get('/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const output = savedOutputRepository.findById(req.params.id, userId);
    if (!output) {
      return res.status(404).json({ error: 'Saved output not found or access denied.' });
    }
    return res.json({ output });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to retrieve saved output.' });
  }
});

// PUT /api/saved-outputs/:id - Update / rename / re-associate saved output
savedOutputRouter.put('/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { title, projectId, content, metadata } = req.body;

    const updated = savedOutputRepository.update(req.params.id, userId, {
      title,
      project_id: projectId,
      content,
      metadata,
    });

    if (!updated) {
      return res.status(404).json({ error: 'Saved output not found or access denied.' });
    }

    return res.json({ output: updated });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to update saved output.' });
  }
});

// DELETE /api/saved-outputs/:id - Delete saved output
savedOutputRouter.delete('/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const deleted = savedOutputRepository.delete(req.params.id, userId);
    if (!deleted) {
      return res.status(404).json({ error: 'Saved output not found or access denied.' });
    }
    return res.json({ success: true, message: 'Saved output removed from archive.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to delete saved output.' });
  }
});
