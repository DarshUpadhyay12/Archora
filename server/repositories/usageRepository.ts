import { getDb } from '../db/connection';
import { UsageEventRecord, AppLimitsRecord } from '../types/db';

export interface UsageSummary {
  period: 'today' | '7d' | '30d' | 'all';
  dateRange: { start: string | null; end: string };
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalTokens: number | null;
  promptTokens: number | null;
  candidatesTokens: number | null;
  tokensRecordedCount: number;
  tokensUnavailableCount: number;
  moduleCounts: {
    tutor: { total: number; success: number; failed: number; tokens: number | null };
    concept: { total: number; success: number; failed: number; tokens: number | null };
    portfolio: { total: number; success: number; failed: number; tokens: number | null };
  };
  timeline: Array<{
    date: string;
    total: number;
    success: number;
    failed: number;
    tokens: number | null;
  }>;
  recentModules: Array<{
    module: string;
    lastUsed: string;
    totalCalls: number;
  }>;
}

export interface UsageHistoryQuery {
  page?: number;
  limit?: number;
  module?: string;
  status?: string;
  period?: 'today' | '7d' | '30d' | 'all';
}

const DEFAULT_LIMITS: AppLimitsRecord = {
  id: 'limits_default',
  user_id: null,
  max_requests_per_day: 50,
  max_requests_per_month: 1000,
  max_input_chars: 12000,
  max_concurrent_requests: 2,
  daily_warning_threshold: 80,
  monthly_warning_threshold: 80,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

function getPeriodStartDate(period: 'today' | '7d' | '30d' | 'all'): string | null {
  const now = new Date();
  if (period === 'today') {
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return startOfToday.toISOString();
  }
  if (period === '7d') {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString();
  }
  if (period === '30d') {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString();
  }
  return null;
}

export const usageRepository = {
  /**
   * Persists an AI telemetry request event into SQLite.
   */
  recordEvent(data: {
    id: string;
    user_id?: string | null;
    request_id?: string | null;
    module: string;
    model_name: string;
    status: 'success' | 'error' | 'rate_limited';
    tokens_used?: number;
    prompt_tokens?: number | null;
    candidates_tokens?: number | null;
    total_tokens?: number | null;
    error_category?: string | null;
    duration_ms: number;
    input_chars: number;
    created_at?: string;
  }): UsageEventRecord {
    const db = getDb();
    const now = data.created_at || new Date().toISOString();
    const legacyTokens = data.tokens_used !== undefined 
      ? data.tokens_used 
      : (data.total_tokens !== null && data.total_tokens !== undefined ? data.total_tokens : 0);

    const stmt = db.prepare(`
      INSERT INTO usage_events (
        id, user_id, request_id, module, tokens_used, model_name,
        status, prompt_tokens, candidates_tokens, total_tokens,
        error_category, duration_ms, input_chars, created_at
      ) VALUES (
        @id, @user_id, @request_id, @module, @tokens_used, @model_name,
        @status, @prompt_tokens, @candidates_tokens, @total_tokens,
        @error_category, @duration_ms, @input_chars, @created_at
      )
    `);

    stmt.run({
      id: data.id,
      user_id: data.user_id || null,
      request_id: data.request_id || null,
      module: data.module,
      tokens_used: legacyTokens,
      model_name: data.model_name,
      status: data.status,
      prompt_tokens: data.prompt_tokens ?? null,
      candidates_tokens: data.candidates_tokens ?? null,
      total_tokens: data.total_tokens ?? null,
      error_category: data.error_category || null,
      duration_ms: Math.max(0, data.duration_ms),
      input_chars: Math.max(0, data.input_chars),
      created_at: now,
    });

    return {
      id: data.id,
      user_id: data.user_id || null,
      request_id: data.request_id || null,
      module: data.module,
      tokens_used: legacyTokens,
      model_name: data.model_name,
      status: data.status,
      prompt_tokens: data.prompt_tokens ?? null,
      candidates_tokens: data.candidates_tokens ?? null,
      total_tokens: data.total_tokens ?? null,
      error_category: data.error_category || null,
      duration_ms: data.duration_ms,
      input_chars: data.input_chars,
      created_at: now,
    };
  },

  /**
   * Retrieves or initializes application limits.
   */
  getLimits(userId?: string): AppLimitsRecord {
    const db = getDb();
    let row: AppLimitsRecord | undefined;

    if (userId) {
      row = db.prepare(`SELECT * FROM app_limits WHERE user_id = ?`).get(userId) as AppLimitsRecord | undefined;
    }

    if (!row) {
      row = db.prepare(`SELECT * FROM app_limits WHERE user_id IS NULL OR id = 'limits_default'`).get() as AppLimitsRecord | undefined;
    }

    if (!row) {
      // Initialize default limits in DB
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO app_limits (
          id, user_id, max_requests_per_day, max_requests_per_month, max_input_chars,
          max_concurrent_requests, daily_warning_threshold, monthly_warning_threshold, created_at, updated_at
        ) VALUES (
          @id, @user_id, @max_requests_per_day, @max_requests_per_month, @max_input_chars,
          @max_concurrent_requests, @daily_warning_threshold, @monthly_warning_threshold, @created_at, @updated_at
        )
      `).run({
        ...DEFAULT_LIMITS,
        created_at: now,
        updated_at: now,
      });

      return { ...DEFAULT_LIMITS, created_at: now, updated_at: now };
    }

    return row;
  },

  /**
   * Updates application limits in SQLite.
   */
  updateLimits(updates: Partial<AppLimitsRecord>, userId?: string): AppLimitsRecord {
    const db = getDb();
    const current = this.getLimits(userId);
    const now = new Date().toISOString();

    const newDaily = updates.max_requests_per_day ?? current.max_requests_per_day;
    const newMonthly = updates.max_requests_per_month ?? current.max_requests_per_month;
    const newInput = updates.max_input_chars ?? current.max_input_chars;
    const newConcurrent = updates.max_concurrent_requests ?? current.max_concurrent_requests;
    const newDailyWarn = updates.daily_warning_threshold ?? current.daily_warning_threshold;
    const newMonthlyWarn = updates.monthly_warning_threshold ?? current.monthly_warning_threshold;

    db.prepare(`
      UPDATE app_limits SET
        max_requests_per_day = ?,
        max_requests_per_month = ?,
        max_input_chars = ?,
        max_concurrent_requests = ?,
        daily_warning_threshold = ?,
        monthly_warning_threshold = ?,
        updated_at = ?
      WHERE id = ?
    `).run(newDaily, newMonthly, newInput, newConcurrent, newDailyWarn, newMonthlyWarn, now, current.id);

    return this.getLimits(userId);
  },

  /**
   * Counts requests made today for limit enforcement.
   */
  getDailyUsageCount(userId?: string): number {
    const db = getDb();
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    if (userId) {
      const row = db.prepare(`
        SELECT COUNT(*) as count FROM usage_events
        WHERE user_id = ? AND created_at >= ?
      `).get(userId, startOfToday) as { count: number };
      return row?.count || 0;
    } else {
      const row = db.prepare(`
        SELECT COUNT(*) as count FROM usage_events
        WHERE created_at >= ?
      `).get(startOfToday) as { count: number };
      return row?.count || 0;
    }
  },

  /**
   * Counts requests made in the current calendar month.
   */
  getMonthlyUsageCount(userId?: string): number {
    const db = getDb();
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    if (userId) {
      const row = db.prepare(`
        SELECT COUNT(*) as count FROM usage_events
        WHERE user_id = ? AND created_at >= ?
      `).get(userId, startOfMonth) as { count: number };
      return row?.count || 0;
    } else {
      const row = db.prepare(`
        SELECT COUNT(*) as count FROM usage_events
        WHERE created_at >= ?
      `).get(startOfMonth) as { count: number };
      return row?.count || 0;
    }
  },

  /**
   * Computes an accurate, un-faked analytical summary of real SQLite records.
   */
  getSummary(userId?: string, period: 'today' | '7d' | '30d' | 'all' = '30d'): UsageSummary {
    const db = getDb();
    const startDate = getPeriodStartDate(period);
    const now = new Date().toISOString();

    const conditions: string[] = [];
    const params: any[] = [];

    if (userId) {
      conditions.push('user_id = ?');
      params.push(userId);
    }
    if (startDate) {
      conditions.push('created_at >= ?');
      params.push(startDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Overall request counts
    const overviewRow = db.prepare(`
      SELECT 
        COUNT(*) as total_requests,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_requests,
        SUM(CASE WHEN status != 'success' THEN 1 ELSE 0 END) as failed_requests,
        SUM(total_tokens) as total_tokens_sum,
        SUM(prompt_tokens) as prompt_tokens_sum,
        SUM(candidates_tokens) as candidates_tokens_sum,
        SUM(CASE WHEN total_tokens IS NOT NULL THEN 1 ELSE 0 END) as tokens_recorded_count,
        SUM(CASE WHEN total_tokens IS NULL THEN 1 ELSE 0 END) as tokens_unavailable_count
      FROM usage_events
      ${whereClause}
    `).get(...params) as any;

    const totalRequests = overviewRow?.total_requests || 0;
    const successfulRequests = overviewRow?.successful_requests || 0;
    const failedRequests = overviewRow?.failed_requests || 0;
    const totalTokens = overviewRow?.total_tokens_sum !== null && overviewRow?.total_tokens_sum !== undefined
      ? Number(overviewRow.total_tokens_sum)
      : null;
    const promptTokens = overviewRow?.prompt_tokens_sum !== null && overviewRow?.prompt_tokens_sum !== undefined
      ? Number(overviewRow.prompt_tokens_sum)
      : null;
    const candidatesTokens = overviewRow?.candidates_tokens_sum !== null && overviewRow?.candidates_tokens_sum !== undefined
      ? Number(overviewRow.candidates_tokens_sum)
      : null;

    // Breakdown by AI Module
    const moduleRows = db.prepare(`
      SELECT 
        module,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
        SUM(CASE WHEN status != 'success' THEN 1 ELSE 0 END) as failed,
        SUM(total_tokens) as tokens
      FROM usage_events
      ${whereClause}
      GROUP BY module
    `).all(...params) as Array<{ module: string; total: number; success: number; failed: number; tokens: number | null }>;

    const moduleCounts = {
      tutor: { total: 0, success: 0, failed: 0, tokens: null as number | null },
      concept: { total: 0, success: 0, failed: 0, tokens: null as number | null },
      portfolio: { total: 0, success: 0, failed: 0, tokens: null as number | null },
    };

    for (const row of moduleRows) {
      const key = row.module as keyof typeof moduleCounts;
      if (moduleCounts[key]) {
        moduleCounts[key] = {
          total: row.total,
          success: row.success,
          failed: row.failed,
          tokens: row.tokens !== null ? Number(row.tokens) : null,
        };
      }
    }

    // Timeline over time (grouped by day, YYYY-MM-DD)
    const timelineRows = db.prepare(`
      SELECT 
        SUBSTR(created_at, 1, 10) as date,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
        SUM(CASE WHEN status != 'success' THEN 1 ELSE 0 END) as failed,
        SUM(total_tokens) as tokens
      FROM usage_events
      ${whereClause}
      GROUP BY SUBSTR(created_at, 1, 10)
      ORDER BY date ASC
    `).all(...params) as Array<{ date: string; total: number; success: number; failed: number; tokens: number | null }>;

    const timeline = timelineRows.map((r) => ({
      date: r.date,
      total: r.total,
      success: r.success,
      failed: r.failed,
      tokens: r.tokens !== null ? Number(r.tokens) : null,
    }));

    // Most recently used AI modules
    const recentRows = db.prepare(`
      SELECT 
        module,
        MAX(created_at) as last_used,
        COUNT(*) as total_calls
      FROM usage_events
      ${whereClause}
      GROUP BY module
      ORDER BY last_used DESC
    `).all(...params) as Array<{ module: string; last_used: string; total_calls: number }>;

    const recentModules = recentRows.map((r) => ({
      module: r.module,
      lastUsed: r.last_used,
      totalCalls: r.total_calls,
    }));

    return {
      period,
      dateRange: { start: startDate, end: now },
      totalRequests,
      successfulRequests,
      failedRequests,
      totalTokens,
      promptTokens,
      candidatesTokens,
      tokensRecordedCount: overviewRow?.tokens_recorded_count || 0,
      tokensUnavailableCount: overviewRow?.tokens_unavailable_count || 0,
      moduleCounts,
      timeline,
      recentModules,
    };
  },

  /**
   * Retrieves paginated, filterable event logs from SQLite.
   */
  getHistory(userId?: string, query: UsageHistoryQuery = {}): {
    events: UsageEventRecord[];
    total: number;
    page: number;
    totalPages: number;
  } {
    const db = getDb();
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: any[] = [];

    if (userId) {
      conditions.push('user_id = ?');
      params.push(userId);
    }
    if (query.module && query.module !== 'all') {
      conditions.push('module = ?');
      params.push(query.module);
    }
    if (query.status && query.status !== 'all') {
      conditions.push('status = ?');
      params.push(query.status);
    }
    if (query.period) {
      const startDate = getPeriodStartDate(query.period);
      if (startDate) {
        conditions.push('created_at >= ?');
        params.push(startDate);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRow = db.prepare(`SELECT COUNT(*) as total FROM usage_events ${whereClause}`).get(...params) as { total: number };
    const total = countRow?.total || 0;
    const totalPages = Math.ceil(total / limit) || 1;

    const events = db.prepare(`
      SELECT * FROM usage_events
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset) as UsageEventRecord[];

    return {
      events,
      total,
      page,
      totalPages,
    };
  },

  /**
   * Telemetry stats for health inspection.
   */
  getHealthStats(userId?: string): {
    lastSuccess: { timestamp: string; module: string; model: string } | null;
    lastError: { timestamp: string; module: string; errorCategory: string | null } | null;
  } {
    const db = getDb();
    const userCondition = userId ? 'WHERE user_id = ?' : '';
    const userParams = userId ? [userId] : [];

    const successRow = db.prepare(`
      SELECT created_at, module, model_name
      FROM usage_events
      ${userCondition ? userCondition + ' AND' : 'WHERE'} status = 'success'
      ORDER BY created_at DESC
      LIMIT 1
    `).get(...userParams) as any;

    const errorRow = db.prepare(`
      SELECT created_at, module, error_category
      FROM usage_events
      ${userCondition ? userCondition + ' AND' : 'WHERE'} status != 'success'
      ORDER BY created_at DESC
      LIMIT 1
    `).get(...userParams) as any;

    return {
      lastSuccess: successRow
        ? { timestamp: successRow.created_at, module: successRow.module, model: successRow.model_name }
        : null,
      lastError: errorRow
        ? { timestamp: errorRow.created_at, module: errorRow.module, errorCategory: errorRow.error_category }
        : null,
    };
  },

  /**
   * Backwards compatible getUsageSummary
   */
  getUsageSummary(userId?: string) {
    const summary = this.getSummary(userId, '30d');
    const dailyUsed = this.getDailyUsageCount(userId);
    return {
      totalRequests: summary.totalRequests,
      tokensEstimated: summary.totalTokens || 0,
      dailyRequestsUsed: dailyUsed,
      moduleCounts: {
        tutor: summary.moduleCounts.tutor.total,
        concept: summary.moduleCounts.concept.total,
        portfolio: summary.moduleCounts.portfolio.total,
      },
    };
  }
};
