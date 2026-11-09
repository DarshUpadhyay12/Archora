-- Archora Architecture Studio - Migration 008: Google Drive Cloud Backup Expansion

-- Table to securely store user-specific Google OAuth2 tokens on the backend
CREATE TABLE IF NOT EXISTS google_oauth_tokens (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  google_email TEXT,
  google_name TEXT,
  google_picture TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expiry INTEGER,
  scope TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_google_oauth_tokens_email ON google_oauth_tokens(google_email);

-- Table to track backups uploaded to Google Drive
CREATE TABLE IF NOT EXISTS cloud_backups (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  local_backup_id TEXT REFERENCES backup_records(id) ON DELETE SET NULL,
  google_drive_file_id TEXT NOT NULL UNIQUE,
  google_drive_folder_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  checksum_sha256 TEXT,
  file_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  uploaded_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cloud_backups_user_id ON cloud_backups(user_id);
CREATE INDEX IF NOT EXISTS idx_cloud_backups_folder_id ON cloud_backups(google_drive_folder_id);
CREATE INDEX IF NOT EXISTS idx_cloud_backups_uploaded_at ON cloud_backups(uploaded_at);

-- Extend user_settings with Google Drive cloud backup preferences
ALTER TABLE user_settings ADD COLUMN google_drive_folder_id TEXT DEFAULT '1hTYk7StoL5GsRpitJyAwdaVf_ivleUWl';
ALTER TABLE user_settings ADD COLUMN google_drive_folder_name TEXT;
ALTER TABLE user_settings ADD COLUMN google_drive_folder_status TEXT DEFAULT 'unverified';
ALTER TABLE user_settings ADD COLUMN google_drive_last_verified TEXT;
ALTER TABLE user_settings ADD COLUMN google_drive_last_backup TEXT;
