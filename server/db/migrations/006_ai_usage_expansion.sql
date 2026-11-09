-- Archora Architecture Studio - Migration 006: AI Usage & Limit Management Expansion

-- Extend usage_events table with granular telemetry & token metrics
ALTER TABLE usage_events ADD COLUMN request_id TEXT;
ALTER TABLE usage_events ADD COLUMN status TEXT NOT NULL DEFAULT 'success';
ALTER TABLE usage_events ADD COLUMN prompt_tokens INTEGER;
ALTER TABLE usage_events ADD COLUMN candidates_tokens INTEGER;
ALTER TABLE usage_events ADD COLUMN total_tokens INTEGER;
ALTER TABLE usage_events ADD COLUMN error_category TEXT;
ALTER TABLE usage_events ADD COLUMN duration_ms INTEGER NOT NULL DEFAULT 0;
ALTER TABLE usage_events ADD COLUMN input_chars INTEGER NOT NULL DEFAULT 0;

-- Performance indexes for analytical queries and telemetry dashboards
CREATE INDEX IF NOT EXISTS idx_usage_events_user_status ON usage_events(user_id, status);
CREATE INDEX IF NOT EXISTS idx_usage_events_status_created ON usage_events(status, created_at);
CREATE INDEX IF NOT EXISTS idx_usage_events_request_id ON usage_events(request_id);

-- Application-level configurable limits table
CREATE TABLE IF NOT EXISTS app_limits (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  max_requests_per_day INTEGER NOT NULL DEFAULT 50,
  max_requests_per_month INTEGER NOT NULL DEFAULT 1000,
  max_input_chars INTEGER NOT NULL DEFAULT 12000,
  max_concurrent_requests INTEGER NOT NULL DEFAULT 2,
  daily_warning_threshold INTEGER NOT NULL DEFAULT 80,
  monthly_warning_threshold INTEGER NOT NULL DEFAULT 80,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_app_limits_user_id ON app_limits(user_id);

