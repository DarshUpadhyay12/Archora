import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware';
import { aiRateLimiter } from '../middleware/rateLimiter';
import { vastuService } from '../services/vastuService';
import { vastuRepository } from '../repositories/vastuRepository';
import { VASTU_DIRECTIONS, VASTU_RULES_CATALOG } from '../services/vastuKnowledgeBase';

export const vastuRouter = Router();

// 1. GET /api/vastu/directions - Canonical directional metadata (open to authenticated users)
vastuRouter.get('/directions', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  return res.json({ directions: VASTU_DIRECTIONS });
});

// 2. GET /api/vastu/rules - Browse and search knowledge rules catalog
vastuRouter.get('/rules', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { space_type, direction, tradition } = req.query;
    const rules = vastuRepository.getRules({
      space_type: typeof space_type === 'string' ? space_type : undefined,
      direction: typeof direction === 'string' ? direction : undefined,
      tradition: typeof tradition === 'string' ? tradition : undefined,
    });
    return res.json({ rules, total: rules.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to retrieve Vastu rules.' });
  }
});

// 3. POST /api/vastu/evaluate - Deterministic layout evaluation
vastuRouter.post('/evaluate', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { rooms, geographicNorthDegrees, buildingType, tradition } = req.body;
    if (!rooms || !Array.isArray(rooms)) {
      return res.status(400).json({ error: 'rooms array is required for evaluation.' });
    }

    const northDegrees = typeof geographicNorthDegrees === 'number' ? geographicNorthDegrees : 0;
    const evaluation = vastuService.evaluateLayout(
      rooms,
      northDegrees,
      buildingType || 'Residential',
      tradition || 'Manasara'
    );

    return res.json({ evaluation });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Evaluation failed.' });
  }
});

// 4. POST /api/vastu/ai-commentary - AI architectural commentary (Zero-cost Gemini proxy)
vastuRouter.post('/ai-commentary', requireAuth, aiRateLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { evaluation, userQuery } = req.body;
    if (!evaluation || !evaluation.roomEvaluations) {
      return res.status(400).json({ error: 'Valid deterministic evaluation data is required.' });
    }

    const commentary = await vastuService.generateAiCommentary(evaluation, userQuery);
    return res.json({ commentary });
  } catch (err: any) {
    console.error('[VastuRoutes] AI commentary error:', err.message);
    return res.status(500).json({ error: err.message || 'AI architectural commentary failed.' });
  }
});

// 5. GET /api/vastu/analyses - List user's saved analyses
vastuRouter.get('/analyses', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { projectId } = req.query;
    const analyses = vastuRepository.listByUser(userId, typeof projectId === 'string' ? projectId : undefined);
    
    // Parse json columns for client convenience
    const parsed = analyses.map(a => ({
      ...a,
      rooms: JSON.parse(a.rooms_json || '[]'),
      results: JSON.parse(a.results_json || '{}')
    }));

    return res.json({ analyses: parsed, total: parsed.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to list analyses.' });
  }
});

// 6. GET /api/vastu/analyses/:id - Get single analysis
vastuRouter.get('/analyses/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const analysis = vastuRepository.findById(req.params.id, userId);
    if (!analysis) {
      return res.status(404).json({ error: 'Vastu analysis not found.' });
    }

    return res.json({
      analysis: {
        ...analysis,
        rooms: JSON.parse(analysis.rooms_json || '[]'),
        results: JSON.parse(analysis.results_json || '{}')
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to load analysis.' });
  }
});

// 7. POST /api/vastu/analyses - Save analysis
vastuRouter.post('/analyses', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const {
      title,
      projectId,
      buildingType,
      geographicNorthDegrees,
      floorPlanFileId,
      floorPlanImageUrl,
      orientationConfirmed,
      rooms,
      results,
      summary,
      tradition
    } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Analysis title is required.' });
    }

    const id = `vastu_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const saved = vastuRepository.create({
      id,
      user_id: userId,
      project_id: projectId || null,
      title: title.trim(),
      building_type: buildingType || 'Residential',
      geographic_north_degrees: geographicNorthDegrees || 0,
      floor_plan_file_id: floorPlanFileId || null,
      floor_plan_image_url: floorPlanImageUrl || null,
      orientation_confirmed: orientationConfirmed !== false,
      rooms: rooms || [],
      results: results || {},
      summary: summary || null,
      tradition: tradition || 'Manasara'
    });

    return res.status(201).json({
      analysis: {
        ...saved,
        rooms: JSON.parse(saved.rooms_json || '[]'),
        results: JSON.parse(saved.results_json || '{}')
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to save analysis.' });
  }
});

// 8. PUT /api/vastu/analyses/:id - Update analysis
vastuRouter.put('/analyses/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const {
      title,
      projectId,
      buildingType,
      geographicNorthDegrees,
      floorPlanImageUrl,
      orientationConfirmed,
      rooms,
      results,
      summary,
      tradition
    } = req.body;

    const updated = vastuRepository.update(req.params.id, userId, {
      title: title ? title.trim() : undefined,
      project_id: projectId,
      building_type: buildingType,
      geographic_north_degrees: geographicNorthDegrees,
      floor_plan_image_url: floorPlanImageUrl,
      orientation_confirmed: orientationConfirmed,
      rooms: rooms,
      results: results,
      summary: summary,
      tradition: tradition
    });

    if (!updated) {
      return res.status(404).json({ error: 'Analysis not found or unauthorized.' });
    }

    return res.json({
      analysis: {
        ...updated,
        rooms: JSON.parse(updated.rooms_json || '[]'),
        results: JSON.parse(updated.results_json || '{}')
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to update analysis.' });
  }
});

// 9. DELETE /api/vastu/analyses/:id - Delete analysis
vastuRouter.delete('/analyses/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const deleted = vastuRepository.delete(req.params.id, userId);
    if (!deleted) {
      return res.status(404).json({ error: 'Analysis not found or unauthorized.' });
    }
    return res.json({ message: 'Analysis deleted successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to delete analysis.' });
  }
});
