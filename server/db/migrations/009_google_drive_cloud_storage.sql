-- Archora Architecture Studio - Migration 009: Google Drive Cloud Storage & Website Data Synchronization

-- 1. Extend project_files to support primary cloud storage in Google Drive
ALTER TABLE project_files ADD COLUMN google_drive_file_id TEXT DEFAULT NULL;
ALTER TABLE project_files ADD COLUMN cloud_storage_status TEXT DEFAULT 'local'; -- 'local', 'synced', 'cloud_only', 'pending_upload', 'pending_delete'
ALTER TABLE project_files ADD COLUMN cloud_web_view_link TEXT DEFAULT NULL;
ALTER TABLE project_files ADD COLUMN cloud_thumbnail_link TEXT DEFAULT NULL;
ALTER TABLE project_files ADD COLUMN cloud_md5_checksum TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_project_files_gdrive_id ON project_files(google_drive_file_id);
CREATE INDEX IF NOT EXISTS idx_project_files_cloud_status ON project_files(cloud_storage_status);

-- 2. Cloud Synchronization State for Studio Data (Projects, Notes, Conversations, Settings)
CREATE TABLE IF NOT EXISTS cloud_sync_state (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  last_sync_at TEXT,
  sync_status TEXT DEFAULT 'idle', -- 'idle', 'syncing', 'synced', 'error', 'offline'
  snapshot_drive_file_id TEXT,
  snapshot_version INTEGER DEFAULT 1,
  total_synced_projects INTEGER DEFAULT 0,
  total_synced_conversations INTEGER DEFAULT 0,
  total_synced_files INTEGER DEFAULT 0,
  auto_sync_enabled INTEGER DEFAULT 1,
  error_message TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cloud_sync_state_status ON cloud_sync_state(sync_status);

-- 3. Offline Synchronization Queue for resilient operations and network recovery
CREATE TABLE IF NOT EXISTS offline_sync_queue (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL, -- 'file_upload', 'file_delete', 'data_sync'
  entity_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  retry_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'failed'
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_offline_sync_queue_user_status ON offline_sync_queue(user_id, status);
CREATE INDEX IF NOT EXISTS idx_offline_sync_queue_created ON offline_sync_queue(created_at);

