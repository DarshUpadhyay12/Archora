-- Migration 003: AI History & Project Association Expansion
-- Ensures conversations can link to projects and adds indexing for fast history queries

-- Add project_id to conversations if it does not already exist
ALTER TABLE conversations ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE SET NULL;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversations_project_id ON conversations(project_id);
CREATE INDEX IF NOT EXISTS idx_saved_outputs_type ON saved_outputs(type);
CREATE INDEX IF NOT EXISTS idx_saved_outputs_created_at ON saved_outputs(created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at);

