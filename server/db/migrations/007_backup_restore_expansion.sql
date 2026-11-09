-- Archora Architecture Studio - Migration 007: Local Backup & Restore Expansion

-- Extend user_settings with automatic backup preferences
ALTER TABLE user_settings ADD COLUMN auto_backup_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_settings ADD COLUMN auto_backup_frequency TEXT NOT NULL DEFAULT 'daily';
ALTER TABLE user_settings ADD COLUMN auto_backup_max_retained INTEGER NOT NULL DEFAULT 5;
ALTER TABLE user_settings ADD COLUMN auto_backup_destination TEXT;
ALTER TABLE user_settings ADD COLUMN auto_backup_last_run TEXT;

-- Table to log completed backup operations
CREATE TABLE IF NOT EXISTS backup_records (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  backup_version TEXT NOT NULL DEFAULT '1.0.0',
  schema_version INTEGER NOT NULL DEFAULT 7,
  is_automatic INTEGER NOT NULL DEFAULT 0,
  checksum_sha256 TEXT,
  file_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_backup_records_user_id ON backup_records(user_id);
CREATE INDEX IF NOT EXISTS idx_backup_records_created_at ON backup_records(created_at);

