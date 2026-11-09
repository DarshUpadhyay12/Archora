-- Migration 005: PDF Exports Expansion
-- Stores audit metadata and generation options for architectural PDF exports

CREATE TABLE IF NOT EXISTS pdf_exports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  export_type TEXT NOT NULL,
  document_title TEXT NOT NULL,
  options_json TEXT NOT NULL DEFAULT '{}',
  file_path TEXT,
  page_count INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pdf_exports_user_id ON pdf_exports(user_id);
CREATE INDEX IF NOT EXISTS idx_pdf_exports_project_id ON pdf_exports(project_id);
CREATE INDEX IF NOT EXISTS idx_pdf_exports_export_type ON pdf_exports(export_type);
CREATE INDEX IF NOT EXISTS idx_pdf_exports_created_at ON pdf_exports(created_at);

