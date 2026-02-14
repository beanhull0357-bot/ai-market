-- ============================================
-- JSONMART Agent Management Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Agents table: tracks AI agents owned by users OR self-registered
CREATE TABLE agents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  owner_id UUID,  -- NULL for self-registered agents
  api_key TEXT UNIQUE,  -- NULL until approved (for self-registered)
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED', 'PENDING_APPROVAL')),
  policy_id TEXT REFERENCES agent_policies(policy_id),
  
  -- Self-registration metadata
  capabilities TEXT[] DEFAULT '{}',
  contact_uri TEXT,
  
  -- Stats
  total_orders INTEGER DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  last_active_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_agents_owner ON agents(owner_id);
CREATE INDEX idx_agents_api_key ON agents(api_key);
CREATE INDEX idx_agents_status ON agents(status);

-- RLS
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

-- Users can only see/manage their own agents
CREATE POLICY "Users manage own agents" ON agents
  FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Also allow anon access for MVP (so non-logged-in users can still demo)
CREATE POLICY "Allow anon read agents" ON agents
  FOR SELECT
  USING (true);

-- Allow anon insert for self-registration (PENDING_APPROVAL only)
CREATE POLICY "Allow anon self-register" ON agents
  FOR INSERT
  WITH CHECK (status = 'PENDING_APPROVAL' AND owner_id IS NULL);

-- ==============================================
-- Migration SQL (run if table already exists):
-- ==============================================
-- ALTER TABLE agents DROP CONSTRAINT IF EXISTS agents_status_check;
-- ALTER TABLE agents ADD CONSTRAINT agents_status_check CHECK (status IN ('ACTIVE', 'REVOKED', 'PENDING_APPROVAL'));
-- ALTER TABLE agents ADD COLUMN IF NOT EXISTS capabilities TEXT[] DEFAULT '{}';
-- ALTER TABLE agents ADD COLUMN IF NOT EXISTS contact_uri TEXT;
-- ALTER TABLE agents ALTER COLUMN owner_id DROP NOT NULL;
-- ALTER TABLE agents ALTER COLUMN api_key DROP NOT NULL;
