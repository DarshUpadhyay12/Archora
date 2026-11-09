  -- Migration 004: File Management Expansion
  -- Upgrades project_files to support global uploads, rich architectural categories, and secure storage metadata

  CREATE TABLE IF NOT EXISTS project_files_v2 (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    original_filename TEXT NOT NULL,
    storage_filename TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_extension TEXT NOT NULL,
    file_size INTEGER NOT NULL DEFAULT 0,
    description TEXT DEFAULT '',
    category TEXT NOT NULL DEFAULT 'Other',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- Copy over any existing records if present
  INSERT OR IGNORE INTO project_files_v2 (
    id, user_id, project_id, original_filename, storage_filename, storage_path, 
    mime_type, file_extension, file_size, description, category, created_at, updated_at
  )
  SELECT 
    id, user_id, project_id, file_name, file_name, file_path_or_url, 
    file_type, '', 0, '', 'Other', created_at, created_at
  FROM project_files;

  DROP TABLE IF EXISTS project_files;
  ALTER TABLE project_files_v2 RENAME TO project_files;

  -- Essential indexes for high-performance filtering, search, and sorting
  CREATE INDEX IF NOT EXISTS idx_project_files_user_id ON project_files(user_id);
  CREATE INDEX IF NOT EXISTS idx_project_files_project_id ON project_files(project_id);
  CREATE INDEX IF NOT EXISTS idx_project_files_category ON project_files(category);
  CREATE INDEX IF NOT EXISTS idx_project_files_mime_type ON project_files(mime_type);
  CREATE INDEX IF NOT EXISTS idx_project_files_created_at ON project_files(created_at);
  CREATE INDEX IF NOT EXISTS idx_project_files_file_extension ON project_files(file_extension);
