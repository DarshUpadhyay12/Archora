import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  AlertTriangle,
  Cpu,
  ShieldAlert,
  Settings,
  RefreshCw,
  Info,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { apiClient } from '@/services/apiClient';
import { showToast } from '@/components/common/Toast';
import { Button, PrimaryButton } from '@/components/common/Buttons';
import { Modal } from '@/components/common/Modal';
import { FormField } from '@/components/common/FormField';
import { LoadingState } from '@/components/common/LoadingAndEmpty';

type PeriodFilter = 'today' | '7d' | '30d' | 'all';

export const AiUsageDashboard: React.FC = () => {
  const [period, setPeriod] = useState<PeriodFilter>('30d');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Analytical Data States
  const [summary, setSummary] = useState<any | null>(null);
  const [limitsStatus, setLimitsStatus] = useState<any | null>(null);
  const [healthData, setHealthData] = useState<any | null>(null);

  // History Log States
  const [historyEvents, setHistoryEvents] = useState<any[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [moduleFilter, setModuleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Limits Configuration Modal State
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isSavingLimits, setIsSavingLimits] = useState(false);
  const [editDailyLimit, setEditDailyLimit] = useState(50);
  const [editMonthlyLimit, setEditMonthlyLimit] = useState(1000);
  const [editMaxInputChars, setEditMaxInputChars] = useState(12000);
  const [editMaxConcurrent, setEditMaxConcurrent] = useState(2);
  const [editDailyWarnThreshold, setEditDailyWarnThreshold] = useState(80);

  // Fetch all live metrics from SQLite
  const loadDashboardData = useCallback(async (selectedPeriod = period, showRefreshSpin = false) => {
    if (showRefreshSpin) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const [sumRes, limRes, healthRes, histRes] = await Promise.all([
        apiClient.getAiUsageSummary(selectedPeriod),
        apiClient.getAiLimits(),
        apiClient.getAiHealth(),
        apiClient.getAiUsageHistory({
          page: 1,
          limit: 10,
          period: selectedPeriod,
          module: moduleFilter !== 'all' ? moduleFilter : undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
        }),
      ]);

      setSummary(sumRes.summary);
      setLimitsStatus(limRes);
      setHealthData(healthRes);

      setHistoryEvents(histRes.events || []);
      setHistoryPage(histRes.page || 1);
      setHistoryTotalPages(histRes.totalPages || 1);
      setHistoryTotal(histRes.total || 0);

      if (limRes.limits) {
        setEditDailyLimit(limRes.limits.max_requests_per_day);
        setEditMonthlyLimit(limRes.limits.max_requests_per_month);
        setEditMaxInputChars(limRes.limits.max_input_chars);
        setEditMaxConcurrent(limRes.limits.max_concurrent_requests);
        setEditDailyWarnThreshold(limRes.limits.daily_warning_threshold);
      }
    } catch (err: any) {
      console.warn('[AiUsageDashboard] Failed to load telemetry data:', err);
      showToast({
        type: 'error',
        title: 'Could Not Load Telemetry',
        message: err.message || 'Failed to connect to usage repository.',
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [period, moduleFilter, statusFilter]);

  // Load paginated history
  const loadHistoryPage = async (page: number) => {
    try {
      const res = await apiClient.getAiUsageHistory({
        page,
        limit: 10,
        period,
        module: moduleFilter !== 'all' ? moduleFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      setHistoryEvents(res.events || []);
      setHistoryPage(res.page);
      setHistoryTotalPages(res.totalPages);
      setHistoryTotal(res.total);
    } catch (err: any) {
      console.warn('[AiUsageDashboard] Error fetching page:', err);
    }
  };

  useEffect(() => {
    loadDashboardData(period);
  }, [period, moduleFilter, statusFilter]);

  const handleSaveLimits = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingLimits(true);
    try {
      await apiClient.updateAiLimits({
        max_requests_per_day: editDailyLimit,
        max_requests_per_month: editMonthlyLimit,
        max_input_chars: editMaxInputChars,
        max_concurrent_requests: editMaxConcurrent,
        daily_warning_threshold: editDailyWarnThreshold,
      });

      showToast({
        type: 'success',
        title: 'Limits Saved',
        message: 'Application usage limits and safety thresholds updated.',
      });
      setIsConfigModalOpen(false);
      loadDashboardData(period, true);
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Save Failed',
        message: err.message || 'Could not update limits.',
      });
    } finally {
      setIsSavingLimits(false);
    }
  };

  if (isLoading && !summary) {
    return (
      <div className="py-12">
        <LoadingState message="Retrieving real SQLite AI telemetry records..." />
      </div>
    );
  }

  const dailyUsed = limitsStatus?.dailyRequestsUsed ?? 0;
  const dailyMax = limitsStatus?.limits?.max_requests_per_day ?? 50;
  const dailyPct = dailyMax > 0 ? Math.min(100, Math.round((dailyUsed / dailyMax) * 100)) : 0;

  const monthlyUsed = limitsStatus?.monthlyRequestsUsed ?? 0;
  const monthlyMax = limitsStatus?.limits?.max_requests_per_month ?? 1000;
  const monthlyPct = monthlyMax > 0 ? Math.min(100, Math.round((monthlyUsed / monthlyMax) * 100)) : 0;

  return (
    <div className="space-y-6 animate-fadeIn text-ink">
      {/* Top Header & Period Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-archBorder/40">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-serif text-xl sm:text-2xl font-semibold text-espresso">
              AI Usage & Application Limit Telemetry
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-50 text-emerald-800 border border-emerald-300">
              ₹0 Free-Tier Protected
            </span>
          </div>
          <p className="text-xs text-ink-muted mt-1">
            Real usage telemetry recorded in SQLite. Zero fabricated statistics or simulated tokens.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Period Toggle Pill */}
          <div className="inline-flex p-1 rounded-xl bg-cream border border-archBorder/60 shadow-sm text-xs font-mono">
            {(['today', '7d', '30d', 'all'] as PeriodFilter[]).map((p) => {
              const labelMap: Record<PeriodFilter, string> = {
                today: 'Today',
                '7d': '7 Days',
                '30d': '30 Days',
                all: 'All Time',
              };
              const active = period === p;
              return (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1 rounded-lg transition-colors ${
                    active
                      ? 'bg-espresso text-cream font-semibold shadow-xs'
                      : 'text-ink-muted hover:text-ink hover:bg-beige/30'
                  }`}
                >
                  {labelMap[p]}
                </button>
              );
            })}
          </div>

          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />}
            onClick={() => loadDashboardData(period, true)}
            title="Refresh SQLite metrics"
          >
            Refresh
          </Button>

          <Button
            variant="secondary"
            size="sm"
            icon={<Settings className="w-3.5 h-3.5" />}
            onClick={() => setIsConfigModalOpen(true)}
            title="Configure application limits"
          >
            Configure Safeguards
          </Button>
        </div>
      </div>

      {/* Critical Usage & Limit Alerts */}
      {limitsStatus?.isDailyExceeded && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-3 text-xs">
          <ShieldAlert className="w-5 h-5 text-rose-700 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-sm">Application Daily Limit Reached ({dailyUsed} / {dailyMax} requests)</p>
            <p className="leading-relaxed">
              New AI inquiries are paused until midnight to preserve your free-tier Google Gemini quota. You can adjust this application limit via <strong>Configure Safeguards</strong> if you need more capacity today.
            </p>
          </div>
        </div>
      )}

      {limitsStatus?.isDailyWarning && !limitsStatus?.isDailyExceeded && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3 text-xs">
          <AlertTriangle className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-sm">Approaching Daily Limit ({dailyUsed} / {dailyMax} requests • {dailyPct}%)</p>
            <p className="leading-relaxed">
              You are approaching your configured daily threshold of {limitsStatus?.limits?.daily_warning_threshold}%. Archora protects your workflow without incurring unintended costs.
            </p>
          </div>
        </div>
      )}

      {healthData?.lastError?.errorCategory === 'provider_quota_429' && (
        <div className="p-4 rounded-2xl bg-orange-50 border border-orange-200 text-orange-950 flex items-start gap-3 text-xs">
          <Info className="w-5 h-5 text-orange-700 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-sm">Provider Quota Rate Limit Encountered (Google HTTP 429)</p>
            <p className="leading-relaxed">
              Google Gemini temporarily rate-limited free-tier requests on their servers at {new Date(healthData.lastError.timestamp).toLocaleTimeString()}. This is a provider-side restriction, independent of your Archora daily limits. Provider quotas typically refresh every 60 seconds.
            </p>
          </div>
        </div>
      )}

      {/* Provider & Health Telemetry Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <div className="p-3.5 rounded-2xl bg-cream border border-archBorder/60 space-y-1">
          <span className="text-[10px] font-mono text-taupe uppercase tracking-wider block">Backend Status</span>
          <div className="flex items-center gap-1.5 font-medium text-emerald-800">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
            <span>Online & Connected</span>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-cream border border-archBorder/60 space-y-1">
          <span className="text-[10px] font-mono text-taupe uppercase tracking-wider block">Configured Gemini Model</span>
          <div className="font-mono text-xs font-semibold text-espresso truncate">
            {healthData?.model || 'gemini-1.5-flash'}
          </div>
          <span className="text-[10px] text-taupe">Strict free-tier mode (no paid fallback)</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-cream border border-archBorder/60 space-y-1">
          <span className="text-[10px] font-mono text-taupe uppercase tracking-wider block">Last Successful Request</span>
          <div className="font-medium text-ink truncate">
            {healthData?.lastSuccess
              ? `${new Date(healthData.lastSuccess.timestamp).toLocaleTimeString()} (${healthData.lastSuccess.module})`
              : 'None recorded yet'}
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-cream border border-archBorder/60 space-y-1">
          <span className="text-[10px] font-mono text-taupe uppercase tracking-wider block">Last Provider Error</span>
          <div className="font-medium text-ink truncate">
            {healthData?.lastError
              ? `${healthData.lastError.errorCategory || 'Error'} at ${new Date(healthData.lastError.timestamp).toLocaleTimeString()}`
              : 'None (Clean operation)'}
          </div>
        </div>
      </div>

      {/* Core Analytical Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Inquiries */}
        <div className="p-5 rounded-2xl bg-cream-light border border-archBorder/70 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-taupe uppercase">Total Inquiries</span>
            <div className="w-7 h-7 rounded-lg bg-beige/50 flex items-center justify-center text-espresso">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-serif font-bold text-espresso">
            {summary?.totalRequests ?? 0}
          </div>
          <div className="flex items-center justify-between text-[11px] text-ink-muted pt-1 border-t border-archBorder/40">
            <span className="text-emerald-700 font-medium">✓ {summary?.successfulRequests ?? 0} Successful</span>
            <span className="text-rose-700 font-medium">✗ {summary?.failedRequests ?? 0} Failed</span>
          </div>
        </div>

        {/* Tokens Processed */}
        <div className="p-5 rounded-2xl bg-cream-light border border-archBorder/70 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-taupe uppercase">Actual Tokens</span>
            <div className="w-7 h-7 rounded-lg bg-beige/50 flex items-center justify-center text-espresso">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-serif font-bold text-espresso">
            {summary?.totalTokens !== null ? summary.totalTokens.toLocaleString() : 'Unavailable'}
          </div>
          <div className="text-[11px] text-ink-muted pt-1 border-t border-archBorder/40 truncate">
            {summary?.totalTokens !== null
              ? `In: ${summary.promptTokens?.toLocaleString() ?? 0} • Out: ${summary.candidatesTokens?.toLocaleString() ?? 0}`
              : 'Recorded strictly when returned by SDK'}
          </div>
        </div>

        {/* Daily Request Progress */}
        <div className="p-5 rounded-2xl bg-cream-light border border-archBorder/70 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-taupe uppercase">Today's Cap</span>
            <span className="text-xs font-mono font-semibold text-espresso">{dailyPct}%</span>
          </div>
          <div className="text-3xl font-serif font-bold text-espresso">
            {dailyUsed} <span className="text-base font-normal text-taupe">/ {dailyMax}</span>
          </div>
          <div className="w-full h-2 rounded-full bg-cream border border-archBorder/60 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                dailyPct >= 100 ? 'bg-rose-600' : dailyPct >= 80 ? 'bg-amber-600' : 'bg-espresso'
              }`}
              style={{ width: `${dailyPct}%` }}
            />
          </div>
        </div>

        {/* Monthly Request Progress */}
        <div className="p-5 rounded-2xl bg-cream-light border border-archBorder/70 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-taupe uppercase">Monthly Cap</span>
            <span className="text-xs font-mono font-semibold text-espresso">{monthlyPct}%</span>
          </div>
          <div className="text-3xl font-serif font-bold text-espresso">
            {monthlyUsed} <span className="text-base font-normal text-taupe">/ {monthlyMax}</span>
          </div>
          <div className="w-full h-2 rounded-full bg-cream border border-archBorder/60 overflow-hidden">
            <div
              className="h-full bg-espresso rounded-full transition-all duration-500"
              style={{ width: `${monthlyPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Module Breakdown & Usage Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Module Breakdown */}
        <div className="lg:col-span-5 p-5 rounded-3xl bg-cream border border-archBorder/70 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-serif text-lg font-semibold text-espresso">
              Usage by Studio Module
            </h4>
            <span className="text-[11px] font-mono text-taupe">Real records</span>
          </div>

          <div className="space-y-3">
            {[
              { id: 'tutor', name: 'Architecture Tutor', data: summary?.moduleCounts?.tutor },
              { id: 'concept', name: 'Design Concept Generator', data: summary?.moduleCounts?.concept },
              { id: 'portfolio', name: 'Jury & Portfolio Assistant', data: summary?.moduleCounts?.portfolio },
            ].map((m) => {
              const count = m.data?.total || 0;
              const totalReqs = summary?.totalRequests || 1;
              const share = Math.round((count / totalReqs) * 100);

              return (
                <div key={m.id} className="p-3 rounded-2xl bg-cream-light border border-archBorder/50 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-ink">{m.name}</span>
                    <span className="font-mono text-espresso font-semibold">{count} calls ({share}%)</span>
                  </div>
                  <div className="w-full h-1.5 bg-cream border border-archBorder/40 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-espresso rounded-full"
                      style={{ width: `${share}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-taupe pt-0.5">
                    <span>{m.data?.success || 0} ok • {m.data?.failed || 0} err</span>
                    <span>{m.data?.tokens !== null ? `${m.data?.tokens.toLocaleString()} tokens` : 'Tokens not reported'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Timeline Over Time */}
        <div className="lg:col-span-7 p-5 rounded-3xl bg-cream border border-archBorder/70 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-serif text-lg font-semibold text-espresso">
              Request Activity Timeline
            </h4>
            <span className="text-[11px] font-mono text-taupe">Daily activity</span>
          </div>

          {summary?.timeline && summary.timeline.length > 0 ? (
            <div className="space-y-2 pt-2">
              <div className="flex items-end gap-2 h-40 pt-4 border-b border-archBorder/60 px-2 overflow-x-auto">
                {summary.timeline.slice(-14).map((day: any) => {
                  const maxDay = Math.max(...summary.timeline.map((t: any) => t.total), 1);
                  const barHeight = Math.max(10, Math.round((day.total / maxDay) * 100));

                  return (
                    <div key={day.date} className="flex-1 min-w-[28px] flex flex-col items-center gap-1 group">
                      <div className="text-[9px] font-mono text-taupe opacity-0 group-hover:opacity-100 transition-opacity">
                        {day.total}
                      </div>
                      <div
                        className="w-full bg-espresso/80 group-hover:bg-espresso rounded-t-md transition-all"
                        style={{ height: `${barHeight}%` }}
                        title={`${day.date}: ${day.total} calls (${day.success} ok, ${day.failed} err)`}
                      />
                      <span className="text-[9px] font-mono text-taupe truncate w-full text-center">
                        {day.date.slice(5)}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-ink-muted text-center pt-1 font-mono">
                Showing daily inquiry distribution from actual SQLite telemetry records.
              </p>
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-ink-muted font-sans">
              No daily inquiry activity recorded in this date range.
            </div>
          )}
        </div>
      </div>

      {/* Historical Telemetry Request Log Table */}
      <div className="p-5 rounded-3xl bg-cream border border-archBorder/70 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h4 className="font-serif text-lg font-semibold text-espresso">
              Detailed Request Telemetry Log
            </h4>
            <p className="text-xs text-ink-muted">
              Live audit trail of genuine AI API invocations.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              className="bg-cream-light border border-archBorder/60 rounded-xl px-3 py-1.5 text-xs font-mono text-ink focus:outline-none"
            >
              <option value="all">All Modules</option>
              <option value="tutor">Architecture Tutor</option>
              <option value="concept">Concept Generator</option>
              <option value="portfolio">Jury Assistant</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-cream-light border border-archBorder/60 rounded-xl px-3 py-1.5 text-xs font-mono text-ink focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="success">Success</option>
              <option value="error">Error</option>
              <option value="rate_limited">Rate Limited</option>
            </select>
          </div>
        </div>

        {historyEvents.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-archBorder/60 text-taupe font-mono text-[11px]">
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Module</th>
                  <th className="py-2.5 px-3">Model</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Tokens</th>
                  <th className="py-2.5 px-3 text-right">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-archBorder/40">
                {historyEvents.map((event) => {
                  const isSuccess = event.status === 'success';
                  const isRateLimit = event.status === 'rate_limited';

                  return (
                    <tr key={event.id} className="hover:bg-cream-light/60 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-[11px] text-ink-muted">
                        {new Date(event.created_at).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 font-medium capitalize">
                        {event.module}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-taupe">
                        {event.model_name}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono ${
                            isSuccess
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                              : isRateLimit
                              ? 'bg-amber-50 text-amber-900 border border-amber-300'
                              : 'bg-rose-50 text-rose-900 border border-rose-300'
                          }`}
                        >
                          {isSuccess ? '✓ Success' : isRateLimit ? '⚠ Rate Limited' : '✗ Error'}
                        </span>
                        {event.error_category && (
                          <span className="block text-[10px] text-taupe font-mono pt-0.5">
                            {event.error_category}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        {event.total_tokens !== null && event.total_tokens !== undefined ? (
                          <span>{event.total_tokens.toLocaleString()}</span>
                        ) : (
                          <span className="text-taupe text-[11px]">Unavailable</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-taupe">
                        {event.duration_ms}ms
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {historyTotalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-archBorder/40 text-xs">
                <span className="text-taupe font-mono">
                  Showing page {historyPage} of {historyTotalPages} ({historyTotal} events)
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={historyPage <= 1}
                    onClick={() => loadHistoryPage(historyPage - 1)}
                    icon={<ChevronLeft className="w-3.5 h-3.5" />}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={historyPage >= historyTotalPages}
                    onClick={() => loadHistoryPage(historyPage + 1)}
                    icon={<ChevronRight className="w-3.5 h-3.5" />}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-ink-muted">
            No telemetry records match your selected filters.
          </div>
        )}
      </div>

      {/* Limits & Safeguards Configuration Modal */}
      <Modal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        title="Configure Application-Level AI Safeguards"
        subtitle="Enforce student-side caps to guarantee zero unexpected cost."
        maxWidth="lg"
      >
        <form onSubmit={handleSaveLimits} className="space-y-4 text-xs">
          <p className="text-xs text-ink-muted leading-relaxed">
            These safeguards are enforced on the backend before requests reach Google Gemini. Limits are stored persistently in SQLite.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Max Daily Inquiries (Requests / Day)">
              <input
                type="number"
                min={1}
                max={500}
                value={editDailyLimit}
                onChange={(e) => setEditDailyLimit(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-cream border border-archBorder/70 rounded-xl px-3 py-2 text-xs font-mono text-ink"
                required
              />
            </FormField>

            <FormField label="Max Monthly Inquiries (Requests / Month)">
              <input
                type="number"
                min={10}
                max={5000}
                value={editMonthlyLimit}
                onChange={(e) => setEditMonthlyLimit(parseInt(e.target.value, 10) || 10)}
                className="w-full bg-cream border border-archBorder/70 rounded-xl px-3 py-2 text-xs font-mono text-ink"
                required
              />
            </FormField>

            <FormField label="Max Input Characters (Prompt Length)">
              <input
                type="number"
                min={500}
                max={50000}
                value={editMaxInputChars}
                onChange={(e) => setEditMaxInputChars(parseInt(e.target.value, 10) || 500)}
                className="w-full bg-cream border border-archBorder/70 rounded-xl px-3 py-2 text-xs font-mono text-ink"
                required
              />
            </FormField>

            <FormField label="Max Concurrent Inquiries (In-Flight)">
              <input
                type="number"
                min={1}
                max={10}
                value={editMaxConcurrent}
                onChange={(e) => setEditMaxConcurrent(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-cream border border-archBorder/70 rounded-xl px-3 py-2 text-xs font-mono text-ink"
                required
              />
            </FormField>
          </div>

          <FormField label="Daily Warning Alert Threshold (%)">
            <input
              type="number"
              min={10}
              max={99}
              value={editDailyWarnThreshold}
              onChange={(e) => setEditDailyWarnThreshold(parseInt(e.target.value, 10) || 80)}
              className="w-full bg-cream border border-archBorder/70 rounded-xl px-3 py-2 text-xs font-mono text-ink"
              required
            />
            <span className="text-[10px] text-taupe pt-1 block">
              Triggers warning banner when daily consumption reaches this percentage.
            </span>
          </FormField>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-archBorder/40">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsConfigModalOpen(false)}
            >
              Cancel
            </Button>
            <PrimaryButton
              type="submit"
              disabled={isSavingLimits}
            >
              {isSavingLimits ? 'Saving Changes...' : 'Save Studio Limits'}
            </PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
};
