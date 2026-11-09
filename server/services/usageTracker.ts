import { ModuleUsage } from '../types';

class UsageTracker {
  private totalRequests = 0;
  private tutorRequests = 0;
  private conceptRequests = 0;
  private portfolioRequests = 0;
  private estimatedTokens = 0;
  private dailyRequestsUsed = 0;
  private dailyLimit = 150; // Application-defined student quota
  private monthlyLimit = 1500;
  private lastResetDate = new Date().toDateString();
  private lastRequestTime?: string;

  constructor() {
    this.checkDailyReset();
  }

  private checkDailyReset() {
    const today = new Date().toDateString();
    if (this.lastResetDate !== today) {
      this.dailyRequestsUsed = 0;
      this.lastResetDate = today;
    }
  }

  public recordRequest(module: 'tutor' | 'concept' | 'portfolio', tokenCount: number = 450): boolean {
    this.checkDailyReset();

    if (this.dailyRequestsUsed >= this.dailyLimit) {
      return false; // Quota exceeded
    }

    this.totalRequests++;
    this.dailyRequestsUsed++;
    this.estimatedTokens += tokenCount;
    this.lastRequestTime = new Date().toISOString();

    if (module === 'tutor') this.tutorRequests++;
    if (module === 'concept') this.conceptRequests++;
    if (module === 'portfolio') this.portfolioRequests++;

    return true;
  }

  public getUsage(): ModuleUsage {
    this.checkDailyReset();
    return {
      total: this.totalRequests,
      tutor: this.tutorRequests,
      concept: this.conceptRequests,
      portfolio: this.portfolioRequests,
      tokensEstimated: this.estimatedTokens,
      dailyRequestsUsed: this.dailyRequestsUsed,
      dailyLimit: this.dailyLimit,
      monthlyLimit: this.monthlyLimit,
      lastRequestTime: this.lastRequestTime,
    };
  }
}

export const usageTracker = new UsageTracker();

