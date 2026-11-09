-- Anchora Architecture Studio — Migration 002: Project Library Expansion
-- Adds academic subject, site dimensions, dates, design requirements, and structured project notes.

ALTER TABLE projects ADD COLUMN subject TEXT DEFAULT '';
ALTER TABLE projects ADD COLUMN site_dimensions TEXT DEFAULT '';
ALTER TABLE projects ADD COLUMN start_date TEXT DEFAULT '';
ALTER TABLE projects ADD COLUMN expected_completion_date TEXT DEFAULT '';
ALTER TABLE projects ADD COLUMN design_requirements TEXT DEFAULT '';

CREATE TABLE IF NOT EXISTS project_notes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  author TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_project_notes_project_id ON project_notes(project_id);
CREATE INDEX IF NOT EXISTS idx_project_notes_created_at ON project_notes(created_at);

