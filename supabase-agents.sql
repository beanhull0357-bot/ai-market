-- ============================================
-- JSONMART Agent Management Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Agents table: tracks AI agents owned by users
CREATE TABLE agents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  owner_id UUID NOT NULL,
  api_key TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED')),
  policy_id TEXT REFERENCES agent_policies(policy_id),
  
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
