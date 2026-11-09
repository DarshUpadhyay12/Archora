import { usageRepository } from '../repositories/usageRepository';
import { AppLimitsRecord } from '../types/db';

class LimitController {
  private activeConcurrentRequests = 0;

  /**
   * Evaluates application-level limits before dispatching to Gemini API.
   */
  public checkLimits(
    userId: string | undefined,
    inputCharCount: number
  ): {
    allowed: boolean;
    reason?: string;
    type?: 'concurrent_limit' | 'input_size_limit' | 'daily_limit' | 'monthly_limit';
    current?: number;
    limit?: number;
  } {
    const limits = usageRepository.getLimits(userId);

    // 1. Concurrency Check
    if (this.activeConcurrentRequests >= limits.max_concurrent_requests) {
      return {
        allowed: false,
        type: 'concurrent_limit',
        current: this.activeConcurrentRequests,
        limit: limits.max_concurrent_requests,
        reason: `Application concurrency limit reached (${this.activeConcurrentRequests}/${limits.max_concurrent_requests}). Another generation is currently in progress. Please wait a moment for it to complete.`,
      };
    }

    // 2. Input Length Check
    if (inputCharCount > limits.max_input_chars) {
      return {
        allowed: false,
        type: 'input_size_limit',
        current: inputCharCount,
        limit: limits.max_input_chars,
        reason: `Input length (${inputCharCount} characters) exceeds the configured application limit of ${limits.max_input_chars} characters. Please shorten your prompt or brief.`,
      };
    }

    // 3. Daily Request Limit Check (from SQLite)
    const dailyCount = usageRepository.getDailyUsageCount(userId);
    if (dailyCount >= limits.max_requests_per_day) {
      return {
        allowed: false,
        type: 'daily_limit',
        current: dailyCount,
        limit: limits.max_requests_per_day,
        reason: `Application daily request limit reached (${dailyCount}/${limits.max_requests_per_day} requests today). This is an application-level safeguard designed to preserve free-tier usage. Limit resets at midnight.`,
      };
    }

    // 4. Monthly Request Limit Check (from SQLite)
    const monthlyCount = usageRepository.getMonthlyUsageCount(userId);
    if (monthlyCount >= limits.max_requests_per_month) {
      return {
        allowed: false,
        type: 'monthly_limit',
        current: monthlyCount,
        limit: limits.max_requests_per_month,
        reason: `Application monthly request limit reached (${monthlyCount}/${limits.max_requests_per_month} requests this month). Please review your studio limits.`,
      };
    }

    return { allowed: true };
  }

  /**
   * Acquires a concurrency execution lock.
   */
  public acquireSlot(): void {
    this.activeConcurrentRequests++;
  }

  /**
   * Releases the concurrency execution lock.
   */
  public releaseSlot(): void {
    this.activeConcurrentRequests = Math.max(0, this.activeConcurrentRequests - 1);
  }

  /**
   * Returns current limit configuration and consumption status.
   */
  public getStatus(userId?: string): {
    limits: AppLimitsRecord;
    activeConcurrent: number;
    dailyRequestsUsed: number;
    monthlyRequestsUsed: number;
    dailyRemaining: number;
    monthlyRemaining: number;
    isDailyWarning: boolean;
    isDailyExceeded: boolean;
    isMonthlyWarning: boolean;
    isMonthlyExceeded: boolean;
  } {
    const limits = usageRepository.getLimits(userId);
    const dailyUsed = usageRepository.getDailyUsageCount(userId);
    const monthlyUsed = usageRepository.getMonthlyUsageCount(userId);

    const dailyPercent = limits.max_requests_per_day > 0 
      ? (dailyUsed / limits.max_requests_per_day) * 100 
      : 0;
    const monthlyPercent = limits.max_requests_per_month > 0 
      ? (monthlyUsed / limits.max_requests_per_month) * 100 
      : 0;

    return {
      limits,
      activeConcurrent: this.activeConcurrentRequests,
      dailyRequestsUsed: dailyUsed,
      monthlyRequestsUsed: monthlyUsed,
      dailyRemaining: Math.max(0, limits.max_requests_per_day - dailyUsed),
      monthlyRemaining: Math.max(0, limits.max_requests_per_month - monthlyUsed),
      isDailyWarning: dailyPercent >= limits.daily_warning_threshold && dailyUsed < limits.max_requests_per_day,
      isDailyExceeded: dailyUsed >= limits.max_requests_per_day,
      isMonthlyWarning: monthlyPercent >= limits.monthly_warning_threshold && monthlyUsed < limits.max_requests_per_month,
      isMonthlyExceeded: monthlyUsed >= limits.max_requests_per_month,
    };
  }
}

export const limitController = new LimitController();

