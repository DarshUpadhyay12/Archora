-- ====================================================================
-- MIGRATION 010: VASTUVISION AI PLANNER & KNOWLEDGE BASE SCHEMA
-- ====================================================================

-- 1. Vastu Analyses Table: Stores floor-plan assessments, orientation, room placements, and findings
CREATE TABLE IF NOT EXISTS vastu_analyses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  building_type TEXT NOT NULL DEFAULT 'Residential',
  geographic_north_degrees REAL NOT NULL DEFAULT 0.0,
  floor_plan_file_id TEXT REFERENCES project_files(id) ON DELETE SET NULL,
  floor_plan_image_url TEXT,
  orientation_confirmed INTEGER NOT NULL DEFAULT 1,
  rooms_json TEXT NOT NULL DEFAULT '[]',
  results_json TEXT NOT NULL DEFAULT '{}',
  summary TEXT,
  tradition TEXT NOT NULL DEFAULT 'Manasara',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vastu_analyses_user ON vastu_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_vastu_analyses_project ON vastu_analyses(project_id);
CREATE INDEX IF NOT EXISTS idx_vastu_analyses_created ON vastu_analyses(created_at DESC);

-- 2. Vastu Knowledge Rules Table: Authoritative, sourced traditional principles
CREATE TABLE IF NOT EXISTS vastu_knowledge_rules (
  id TEXT PRIMARY KEY,
  rule_id TEXT UNIQUE NOT NULL,
  topic TEXT NOT NULL,
  direction TEXT NOT NULL,
  space_type TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  explanation TEXT NOT NULL,
  source_reference TEXT NOT NULL,
  tradition TEXT NOT NULL,
  variations TEXT,
  confidence_level TEXT NOT NULL DEFAULT 'Traditional Classical',
  architectural_rationale TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vastu_rules_topic ON vastu_knowledge_rules(topic);
CREATE INDEX IF NOT EXISTS idx_vastu_rules_direction ON vastu_knowledge_rules(direction);
CREATE INDEX IF NOT EXISTS idx_vastu_rules_space ON vastu_knowledge_rules(space_type);
CREATE INDEX IF NOT EXISTS idx_vastu_rules_tradition ON vastu_knowledge_rules(tradition);
