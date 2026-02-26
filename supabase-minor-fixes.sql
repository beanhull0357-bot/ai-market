-- ============================================
-- JSONMART Minor Fixes — Security & Maintenance
-- 🔧 Run this in Supabase SQL Editor
-- ============================================
-- Created: 2026-02-26
-- Purpose: RLS security fixes + automated cleanup
-- ============================================

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 🔒 RLS FIX: dome_categories (CRITICAL)
-- Table is public but RLS was not enabled
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ALTER TABLE dome_categories ENABLE ROW LEVEL SECURITY;

-- Public read (category mapping is non-sensitive)
CREATE POLICY "Public read dome_categories" ON dome_categories
  FOR SELECT USING (true);

-- Only authenticated users can modify
CREATE POLICY "Auth manage dome_categories" ON dome_categories
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth update dome_categories" ON dome_categories
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth delete dome_categories" ON dome_categories
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 🔒 RLS FIX: agent_register_attempts (CRITICAL)
-- Table is public but RLS was not enabled
-- This table should NOT be directly accessible via API
-- Only SECURITY DEFINER RPCs should write to it
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ALTER TABLE agent_register_attempts ENABLE ROW LEVEL SECURITY;

-- No direct access — only via SECURITY DEFINER RPCs (agent_self_register)
-- Admin (authenticated) can read for monitoring
CREATE POLICY "Auth read register_attempts" ON agent_register_attempts
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Block all direct inserts/updates/deletes from API
-- (agent_self_register RPC uses SECURITY DEFINER which bypasses RLS)

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 1. Agent Registration Attempts Cleanup
-- agent_register_attempts stores IP-based rate limiting records
-- These are only needed for 1 hour but accumulate over time
-- This function deletes records older than 24 hours
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION cleanup_register_attempts()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_deleted INT;
BEGIN
    DELETE FROM agent_register_attempts
    WHERE created_at < NOW() - INTERVAL '24 hours';

    GET DIAGNOSTICS v_deleted = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'deleted', v_deleted,
        'message', v_deleted || ' expired registration attempts cleaned up'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_register_attempts() TO authenticated;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 2. Expired Order Authorization Cleanup
-- Orders with AUTHORIZED payment_status older than 24h
-- should be auto-voided to release stock holds
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION cleanup_expired_orders()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_voided INT;
BEGIN
    UPDATE orders
    SET status = 'VOIDED',
        payment_status = 'VOIDED',
        updated_at = NOW()
    WHERE payment_status = 'AUTHORIZED'
      AND capture_deadline IS NOT NULL
      AND capture_deadline < NOW();

    GET DIAGNOSTICS v_voided = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'voided', v_voided,
        'message', v_voided || ' expired authorizations voided'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_expired_orders() TO authenticated;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 3. pg_cron Schedules (if pg_cron extension is available)
-- Uncomment below to enable automatic scheduling
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Every hour: clean up old registration attempts
-- SELECT cron.schedule('cleanup-register-attempts', '0 * * * *',
--   $$SELECT cleanup_register_attempts()$$);

-- Every 30 minutes: void expired order authorizations
-- SELECT cron.schedule('cleanup-expired-orders', '*/30 * * * *',
--   $$SELECT cleanup_expired_orders()$$);

-- View scheduled jobs:
-- SELECT * FROM cron.job;
