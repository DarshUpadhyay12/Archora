import { Router, Response } from 'express';
import crypto from 'crypto';
import { geminiService } from '../services/geminiService';
import { usageRepository } from '../repositories/usageRepository';
import { limitController } from '../services/limitController';
import { conversationRepository } from '../repositories/conversationRepository';
import { savedOutputRepository } from '../repositories/savedOutputRepository';
import { optionalAuth, AuthenticatedRequest } from '../middleware/authMiddleware';
import { aiRateLimiter } from '../middleware/rateLimiter';
import { TutorRequest, ConceptRequest, PortfolioRequest } from '../types';

export const aiRouter = Router();

aiRouter.use(optionalAuth);

/**
 * GET /api/ai/health
 * Comprehensive AI service and provider health telemetry.
 */
aiRouter.get('/health', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const healthStats = usageRepository.getHealthStats(userId);

  res.json({
    status: 'ok',
    configured: geminiService.isConfigured(),
    model: geminiService.getModelName(),
    isFreeTier: true,
    lastSuccess: healthStats.lastSuccess,
    lastError: healthStats.lastError,
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/ai/limits
 * Returns application-level limits and current usage counters.
 */
aiRouter.get('/limits', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const status = limitController.getStatus(userId);
  res.json({
    status: 'ok',
    ...status,
  });
});

/**
 * PUT /api/ai/limits
 * Configures application-level limits in SQLite.
 */
aiRouter.put('/limits', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const {
    max_requests_per_day,
    max_requests_per_month,
    max_input_chars,
    max_concurrent_requests,
    daily_warning_threshold,
    monthly_warning_threshold,
  } = req.body;

  const updated = usageRepository.updateLimits({
    max_requests_per_day: typeof max_requests_per_day === 'number' ? Math.max(1, max_requests_per_day) : undefined,
    max_requests_per_month: typeof max_requests_per_month === 'number' ? Math.max(1, max_requests_per_month) : undefined,
    max_input_chars: typeof max_input_chars === 'number' ? Math.max(100, max_input_chars) : undefined,
    max_concurrent_requests: typeof max_concurrent_requests === 'number' ? Math.max(1, max_concurrent_requests) : undefined,
    daily_warning_threshold: typeof daily_warning_threshold === 'number' ? Math.min(100, Math.max(10, daily_warning_threshold)) : undefined,
    monthly_warning_threshold: typeof monthly_warning_threshold === 'number' ? Math.min(100, Math.max(10, monthly_warning_threshold)) : undefined,
  }, userId);

  res.json({
    status: 'ok',
    limits: updated,
    message: 'Application limits updated successfully.',
  });
});

/**
 * GET /api/ai/usage/summary
 * Detailed analytical summary over selectable date ranges (today, 7d, 30d, all).
 */
aiRouter.get('/usage/summary', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const period = (req.query.period as any) || '30d';
  const summary = usageRepository.getSummary(userId, period);

  res.json({
    status: 'ok',
    summary,
  });
});

/**
 * GET /api/ai/usage/history
 * Paginated log of real SQLite AI request telemetry records.
 */
aiRouter.get('/usage/history', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 20;
  const moduleParam = (req.query.module as string) || undefined;
  const statusParam = (req.query.status as string) || undefined;
  const period = (req.query.period as any) || undefined;

  const history = usageRepository.getHistory(userId, {
    page,
    limit,
    module: moduleParam,
    status: statusParam,
    period,
  });

  res.json({
    status: 'ok',
    ...history,
  });
});

/**
 * GET /api/ai/usage
 * Backward-compatible endpoint returning unified metrics.
 */
aiRouter.get('/usage', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const summary = usageRepository.getSummary(userId, '30d');
  const limits = limitController.getStatus(userId);

  res.json({
    status: 'ok',
    usage: {
      total: summary.totalRequests,
      tutor: summary.moduleCounts.tutor.total,
      concept: summary.moduleCounts.concept.total,
      portfolio: summary.moduleCounts.portfolio.total,
      tokensEstimated: summary.totalTokens || 0,
      dailyRequestsUsed: limits.dailyRequestsUsed,
      dailyLimit: limits.limits.max_requests_per_day,
      monthlyLimit: limits.limits.max_requests_per_month,
      lastRequestTime: summary.recentModules[0]?.lastUsed,
    },
    limits: limits.limits,
    model: geminiService.getModelName(),
  });
});

// ============================================================================
// 1. POST /api/ai/tutor
// ============================================================================
aiRouter.post('/tutor', aiRateLimiter, async (req: AuthenticatedRequest, res: Response) => {
  const { question, topic, history, conversationId } = req.body as TutorRequest & { conversationId?: string };
  const userId = req.user?.id;
  const requestId = `req_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const startTime = Date.now();

  if (!question || typeof question !== 'string' || !question.trim()) {
    return res.status(400).json({ error: 'A question prompt is required.' });
  }

  const promptChars = question.trim().length + (topic ? topic.length : 0);

  // 1. Application-level safeguards & limit checking
  const limitCheck = limitController.checkLimits(userId, promptChars);
  if (!limitCheck.allowed) {
    usageRepository.recordEvent({
      id: `evt_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      user_id: userId || null,
      request_id: requestId,
      module: 'tutor',
      model_name: geminiService.getModelName(),
      status: 'rate_limited',
      error_category: limitCheck.type || 'application_limit',
      duration_ms: Date.now() - startTime,
      input_chars: promptChars,
    });

    const statusCode = limitCheck.type === 'input_size_limit' ? 400 : 429;
    return res.status(statusCode).json({
      error: limitCheck.reason,
      isAppLimit: true,
      limitType: limitCheck.type,
      current: limitCheck.current,
      limit: limitCheck.limit,
    });
  }

  if (!geminiService.isConfigured()) {
    return res.status(503).json({
      error: 'Gemini API is not configured on the backend. Please check your .env file.'
    });
  }

  // Acquire concurrency execution slot
  limitController.acquireSlot();

  try {
    let effectiveHistory = history;
    let activeConvId = conversationId;

    if (activeConvId && userId && (!history || history.length === 0)) {
      const dbMessages = conversationRepository.getMessages(activeConvId, userId);
      effectiveHistory = dbMessages.slice(-8).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));
    }

    // Call official Gemini API with configured model
    const result = await geminiService.askTutor({
      question: question.trim(),
      topic,
      history: effectiveHistory,
    });

    const durationMs = result.durationMs ?? (Date.now() - startTime);

    // Record verified usage event in SQLite
    const eventId = `evt_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    usageRepository.recordEvent({
      id: eventId,
      user_id: userId || null,
      request_id: requestId,
      module: 'tutor',
      model_name: result.modelUsed || geminiService.getModelName(),
      status: 'success',
      prompt_tokens: result.tokens?.promptTokens ?? null,
      candidates_tokens: result.tokens?.candidatesTokens ?? null,
      total_tokens: result.tokens?.totalTokens ?? null,
      duration_ms: durationMs,
      input_chars: promptChars,
    });

    // Automatic SQLite conversation persistence for authenticated sessions
    if (userId) {
      try {
        if (!activeConvId) {
          activeConvId = `conv_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
          const cleanTitle = question.trim().length > 50
            ? `${question.trim().slice(0, 47)}...`
            : question.trim();

          conversationRepository.createConversation({
            id: activeConvId,
            user_id: userId,
            module: 'tutor',
            title: cleanTitle,
            topic: topic || '',
          });
        }

        conversationRepository.addMessage({
          id: `msg_u_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
          conversation_id: activeConvId,
          user_id: userId,
          role: 'user',
          content: question.trim(),
        });

        conversationRepository.addMessage({
          id: `msg_a_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
          conversation_id: activeConvId,
          user_id: userId,
          role: 'assistant',
          content: result.content,
          citations: result.citations,
          followUpSuggestions: result.followUpSuggestions,
          token_count: result.tokens?.totalTokens || 0,
        });
      } catch (dbErr) {
        console.warn('[Archora DB] Could not record conversation messages:', dbErr);
      }
    }

    return res.json({
      ...result,
      conversationId: activeConvId,
    });
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    const isQuota = err?.status === 429 || err?.isProviderQuota || err.message?.includes('429');
    const status = isQuota ? 429 : 500;
    const errorCat = isQuota ? 'provider_quota_429' : (err.errorCategory || 'api_error');

    // Record failure in SQLite
    usageRepository.recordEvent({
      id: `evt_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      user_id: userId || null,
      request_id: requestId,
      module: 'tutor',
      model_name: geminiService.getModelName(),
      status: isQuota ? 'rate_limited' : 'error',
      error_category: errorCat,
      duration_ms: durationMs,
      input_chars: promptChars,
    });

    return res.status(status).json({
      error: err.message || 'Failed to process inquiry with Gemini API.',
      isProviderQuota: isQuota,
      errorCategory: errorCat,
    });
  } finally {
    limitController.releaseSlot();
  }
});

// ============================================================================
// 2. POST /api/ai/concept
// ============================================================================
aiRouter.post('/concept', aiRateLimiter, async (req: AuthenticatedRequest, res: Response) => {
  const input = req.body as ConceptRequest & { projectId?: string };
  const userId = req.user?.id;
  const requestId = `req_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const startTime = Date.now();

  if (!input.projectTitle || typeof input.projectTitle !== 'string' || !input.projectTitle.trim()) {
    return res.status(400).json({ error: 'A project title is required to generate design concepts.' });
  }

  const promptChars = JSON.stringify(input).length;

  // 1. Application-level safeguards & limit checking
  const limitCheck = limitController.checkLimits(userId, promptChars);
  if (!limitCheck.allowed) {
    usageRepository.recordEvent({
      id: `evt_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      user_id: userId || null,
      request_id: requestId,
      module: 'concept',
      model_name: geminiService.getModelName(),
      status: 'rate_limited',
      error_category: limitCheck.type || 'application_limit',
      duration_ms: Date.now() - startTime,
      input_chars: promptChars,
    });

    const statusCode = limitCheck.type === 'input_size_limit' ? 400 : 429;
    return res.status(statusCode).json({
      error: limitCheck.reason,
      isAppLimit: true,
      limitType: limitCheck.type,
      current: limitCheck.current,
      limit: limitCheck.limit,
    });
  }

  if (!geminiService.isConfigured()) {
    return res.status(503).json({
      error: 'Gemini API is not configured on the backend. Please check your .env file.'
    });
  }

  limitController.acquireSlot();

  try {
    const result = await geminiService.generateConcept(input);
    const durationMs = result.durationMs ?? (Date.now() - startTime);

    // Record verified usage event in SQLite
    const eventId = `evt_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    usageRepository.recordEvent({
      id: eventId,
      user_id: userId || null,
      request_id: requestId,
      module: 'concept',
      model_name: result.modelUsed || geminiService.getModelName(),
      status: 'success',
      prompt_tokens: result.tokens?.promptTokens ?? null,
      candidates_tokens: result.tokens?.candidatesTokens ?? null,
      total_tokens: result.tokens?.totalTokens ?? null,
      duration_ms: durationMs,
      input_chars: promptChars,
    });

    let savedOutputId: string | undefined;

    if (userId) {
      try {
        savedOutputId = `out_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
        savedOutputRepository.create({
          id: savedOutputId,
          user_id: userId,
          project_id: input.projectId || null,
          type: 'concept',
          title: result.title || input.projectTitle.trim(),
          content: result.designNarrative,
          metadata: {
            ...result,
            inputRequirements: input,
          },
        });
      } catch (dbErr) {
        console.warn('[Archora DB] Could not auto-save concept:', dbErr);
      }
    }

    return res.json({
      ...result,
      savedOutputId,
    });
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    const isQuota = err?.status === 429 || err?.isProviderQuota || err.message?.includes('429');
    const status = isQuota ? 429 : 500;
    const errorCat = isQuota ? 'provider_quota_429' : (err.errorCategory || 'api_error');

    usageRepository.recordEvent({
      id: `evt_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      user_id: userId || null,
      request_id: requestId,
      module: 'concept',
      model_name: geminiService.getModelName(),
      status: isQuota ? 'rate_limited' : 'error',
      error_category: errorCat,
      duration_ms: durationMs,
      input_chars: promptChars,
    });

    return res.status(status).json({
      error: err.message || 'Failed to generate concept with Gemini API.',
      isProviderQuota: isQuota,
      errorCategory: errorCat,
    });
  } finally {
    limitController.releaseSlot();
  }
});

// ============================================================================
// 3. POST /api/ai/portfolio
// ============================================================================
aiRouter.post('/portfolio', aiRateLimiter, async (req: AuthenticatedRequest, res: Response) => {
  const { type, projectTitle, keyDetails, projectId } = req.body as PortfolioRequest & { projectId?: string };
  const userId = req.user?.id;
  const requestId = `req_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const startTime = Date.now();

  if (!projectTitle || typeof projectTitle !== 'string' || !projectTitle.trim()) {
    return res.status(400).json({ error: 'A project title is required for portfolio and jury generation.' });
  }

  const promptChars = (projectTitle.trim().length) + (keyDetails ? keyDetails.length : 0);

  // 1. Application-level safeguards & limit checking
  const limitCheck = limitController.checkLimits(userId, promptChars);
  if (!limitCheck.allowed) {
    usageRepository.recordEvent({
      id: `evt_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      user_id: userId || null,
      request_id: requestId,
      module: 'portfolio',
      model_name: geminiService.getModelName(),
      status: 'rate_limited',
      error_category: limitCheck.type || 'application_limit',
      duration_ms: Date.now() - startTime,
      input_chars: promptChars,
    });

    const statusCode = limitCheck.type === 'input_size_limit' ? 400 : 429;
    return res.status(statusCode).json({
      error: limitCheck.reason,
      isAppLimit: true,
      limitType: limitCheck.type,
      current: limitCheck.current,
      limit: limitCheck.limit,
    });
  }

  if (!geminiService.isConfigured()) {
    return res.status(503).json({
      error: 'Gemini API is not configured on the backend. Please check your .env file.'
    });
  }

  limitController.acquireSlot();

  try {
    const result = await geminiService.generatePortfolioAsset({
      type: type || 'jury-viva-questions',
      projectTitle: projectTitle.trim(),
      keyDetails,
    });

    const durationMs = result.durationMs ?? (Date.now() - startTime);

    // Record verified usage event in SQLite
    const eventId = `evt_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    usageRepository.recordEvent({
      id: eventId,
      user_id: userId || null,
      request_id: requestId,
      module: 'portfolio',
      model_name: result.modelUsed || geminiService.getModelName(),
      status: 'success',
      prompt_tokens: result.tokens?.promptTokens ?? null,
      candidates_tokens: result.tokens?.candidatesTokens ?? null,
      total_tokens: result.tokens?.totalTokens ?? null,
      duration_ms: durationMs,
      input_chars: promptChars,
    });

    let savedOutputId: string | undefined;

    if (userId) {
      try {
        savedOutputId = `out_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
        savedOutputRepository.create({
          id: savedOutputId,
          user_id: userId,
          project_id: projectId || null,
          type: type || 'jury-viva-questions',
          title: result.title || projectTitle.trim(),
          content: result.content,
          metadata: {
            ...result,
            projectTitle: projectTitle.trim(),
            keyDetails,
            type: type || 'jury-viva-questions',
          },
        });
      } catch (dbErr) {
        console.warn('[Archora DB] Could not auto-save portfolio asset:', dbErr);
      }
    }

    return res.json({
      ...result,
      savedOutputId,
    });
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    const isQuota = err?.status === 429 || err?.isProviderQuota || err.message?.includes('429');
    const status = isQuota ? 429 : 500;
    const errorCat = isQuota ? 'provider_quota_429' : (err.errorCategory || 'api_error');

    usageRepository.recordEvent({
      id: `evt_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      user_id: userId || null,
      request_id: requestId,
      module: 'portfolio',
      model_name: geminiService.getModelName(),
      status: isQuota ? 'rate_limited' : 'error',
      error_category: errorCat,
      duration_ms: durationMs,
      input_chars: promptChars,
    });

    return res.status(status).json({
      error: err.message || 'Failed to generate jury asset with Gemini API.',
      isProviderQuota: isQuota,
      errorCategory: errorCat,
    });
  } finally {
    limitController.releaseSlot();
  }
});
