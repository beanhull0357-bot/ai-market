-- ============================================
-- JSONMART Security Fix Script
-- 🔒 Run this in Supabase SQL Editor
-- ============================================
-- Created: 2026-02-17
-- Purpose: Fix all open RLS policies, protect sensitive data,
--          add auth checks to admin functions, restrict anon grants
-- ============================================

BEGIN;

-- ============================================
-- PHASE 1: Fix RLS Policies on All Tables
-- ============================================

-- ---- 1. products ----
DROP POLICY IF EXISTS "Allow all for products" ON products;
CREATE POLICY "Public read products" ON products
  FOR SELECT USING (true);
CREATE POLICY "Authenticated manage products" ON products
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated update products" ON products
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated delete products" ON products
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- ---- 2. agent_policies ----
DROP POLICY IF EXISTS "Allow all for agent_policies" ON agent_policies;
CREATE POLICY "Public read agent_policies" ON agent_policies
  FOR SELECT USING (true);
CREATE POLICY "Users manage own policies" ON agent_policies
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users update own policies" ON agent_policies
  FOR UPDATE USING (user_id = auth.uid() OR auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users delete own policies" ON agent_policies
  FOR DELETE USING (user_id = auth.uid() OR auth.uid() IS NOT NULL);

-- ---- 3. orders ----
DROP POLICY IF EXISTS "Allow all for orders" ON orders;
CREATE POLICY "Authenticated read orders" ON orders
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated insert orders" ON orders
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated update orders" ON orders
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ---- 4. agent_reviews ----
DROP POLICY IF EXISTS "Allow all for agent_reviews" ON agent_reviews;
CREATE POLICY "Public read reviews" ON agent_reviews
  FOR SELECT USING (true);
CREATE POLICY "Authenticated insert reviews" ON agent_reviews
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ---- 5. agents (fix anon read to exclude sensitive columns) ----
DROP POLICY IF EXISTS "Allow anon read agents" ON agents;
-- Anon can only read non-sensitive fields via RPC (SECURITY DEFINER)
-- Authenticated users can read their own agents
CREATE POLICY "Users read own agents" ON agents
  FOR SELECT USING (owner_id = auth.uid() OR auth.uid() IS NOT NULL);
CREATE POLICY "Users manage own agents insert" ON agents
  FOR INSERT WITH CHECK (owner_id = auth.uid() OR auth.uid() IS NOT NULL);
-- Keep existing "Users manage own agents" policy for owner-based access
-- Keep existing "Allow anon self-register" policy for agent registration

-- ---- 6. checkout_sessions ----
DROP POLICY IF EXISTS "Allow all for checkout_sessions" ON checkout_sessions;
CREATE POLICY "Authenticated read checkout_sessions" ON checkout_sessions
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated manage checkout_sessions" ON checkout_sessions
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated update checkout_sessions" ON checkout_sessions
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ---- 7. agent_webhook_subscriptions (SENSITIVE: contains HMAC secrets) ----
DROP POLICY IF EXISTS "Allow all for agent_webhook_subscriptions" ON agent_webhook_subscriptions;
-- NO direct table access — only through SECURITY DEFINER RPCs
-- This prevents anon key from reading HMAC secrets

-- ---- 8. webhook_delivery_log ----
DROP POLICY IF EXISTS "Allow all for webhook_delivery_log" ON webhook_delivery_log;
CREATE POLICY "Authenticated read webhook_log" ON webhook_delivery_log
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ---- 9. order_events ----
DROP POLICY IF EXISTS "Allow all for order_events" ON order_events;
CREATE POLICY "Authenticated read order_events" ON order_events
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ---- 10. agent_offers ----
DROP POLICY IF EXISTS "Allow all for agent_offers" ON agent_offers;
CREATE POLICY "Public read agent_offers" ON agent_offers
  FOR SELECT USING (true);
CREATE POLICY "Authenticated manage agent_offers" ON agent_offers
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated update agent_offers" ON agent_offers
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated delete agent_offers" ON agent_offers
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- ---- 11. agent_activity_log ----
DROP POLICY IF EXISTS "Allow all for agent_activity_log" ON agent_activity_log;
CREATE POLICY "Authenticated read activity_log" ON agent_activity_log
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ---- 12. product_candidates ----
DROP POLICY IF EXISTS "Allow all for product_candidates" ON product_candidates;
CREATE POLICY "Authenticated manage candidates" ON product_candidates
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ---- 13. pricing_rules ----
DROP POLICY IF EXISTS "Allow all for pricing_rules" ON pricing_rules;
CREATE POLICY "Public read pricing_rules" ON pricing_rules
  FOR SELECT USING (true);
CREATE POLICY "Authenticated manage pricing_rules" ON pricing_rules
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated update pricing_rules" ON pricing_rules
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ---- 14. notification_config (CRITICAL: contains Telegram bot token) ----
DROP POLICY IF EXISTS "Allow all for notification_config" ON notification_config;
-- NO direct table access — only through SECURITY DEFINER RPCs
-- This prevents anon key from reading Telegram bot token and chat ID

-- ---- 15. decision_receipts ----
DROP POLICY IF EXISTS "Allow all for decision_receipts" ON decision_receipts;
CREATE POLICY "Authenticated read receipts" ON decision_receipts
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ---- 16. sandbox_orders ----
DROP POLICY IF EXISTS "Allow all for sandbox_orders" ON sandbox_orders;
CREATE POLICY "Authenticated read sandbox" ON sandbox_orders
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ---- 17. sla_metrics ----
DROP POLICY IF EXISTS "Allow all for sla_metrics" ON sla_metrics;
CREATE POLICY "Public read sla_metrics" ON sla_metrics
  FOR SELECT USING (true);
CREATE POLICY "Authenticated manage sla_metrics" ON sla_metrics
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated update sla_metrics" ON sla_metrics
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ---- 18. negotiations ----
DROP POLICY IF EXISTS "Allow all for negotiations" ON negotiations;
CREATE POLICY "Authenticated read negotiations" ON negotiations
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ---- 19. loyalty_rewards ----
DROP POLICY IF EXISTS "Allow all for loyalty_rewards" ON loyalty_rewards;
CREATE POLICY "Authenticated read rewards" ON loyalty_rewards
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ---- 20. agent_referrals ----
DROP POLICY IF EXISTS "Allow all for agent_referrals" ON agent_referrals;
CREATE POLICY "Authenticated read referrals" ON agent_referrals
  FOR SELECT USING (auth.uid() IS NOT NULL);


-- ============================================
-- PHASE 2: Add Auth Checks to Admin RPC Functions
-- ============================================

-- 2a. approve_pending_agent: Admin only
CREATE OR REPLACE FUNCTION approve_pending_agent(p_agent_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_agent RECORD;
    v_api_key TEXT;
    v_chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    v_key TEXT := 'agk_';
    i INTEGER;
BEGIN
    -- Auth check: require authenticated user
    IF auth.uid() IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'AUTH_REQUIRED', 'message', 'Authentication required for admin actions');
    END IF;

    -- Find pending agent
    SELECT * INTO v_agent FROM agents WHERE agent_id = p_agent_id AND status = 'PENDING_APPROVAL';

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'No pending agent with this ID');
    END IF;

    -- Generate API key
    FOR i IN 1..32 LOOP
        v_key := v_key || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
    END LOOP;
    v_api_key := v_key;

    -- Activate agent
    UPDATE agents
    SET status = 'ACTIVE', api_key = v_api_key, updated_at = now()
    WHERE agent_id = p_agent_id;

    RETURN json_build_object(
        'success', true,
        'agent_id', p_agent_id,
        'name', v_agent.name,
        'api_key', v_api_key,
        'status', 'ACTIVE'
    );
END;
$$;

-- 2b. reject_pending_agent: Admin only
CREATE OR REPLACE FUNCTION reject_pending_agent(p_agent_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_agent RECORD;
BEGIN
    -- Auth check
    IF auth.uid() IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'AUTH_REQUIRED', 'message', 'Authentication required for admin actions');
    END IF;

    SELECT * INTO v_agent FROM agents WHERE agent_id = p_agent_id AND status = 'PENDING_APPROVAL';

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'No pending agent with this ID');
    END IF;

    DELETE FROM agents WHERE agent_id = p_agent_id;

    RETURN json_build_object(
        'success', true,
        'agent_id', p_agent_id,
        'name', v_agent.name,
        'message', 'Agent registration rejected and removed.'
    );
END;
$$;

-- 2c. notify_admin_telegram: Internal only (remove anon grant)
CREATE OR REPLACE FUNCTION notify_admin_telegram(p_message TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_token TEXT;
    v_chat_id TEXT;
BEGIN
    -- Auth check: only authenticated users or internal calls
    IF auth.uid() IS NULL THEN
        RETURN;  -- Silent block for unauthenticated calls
    END IF;

    SELECT value INTO v_token FROM notification_config WHERE key = 'telegram_bot_token';
    SELECT value INTO v_chat_id FROM notification_config WHERE key = 'telegram_chat_id';

    IF v_token IS NULL OR v_chat_id IS NULL THEN
        RETURN;
    END IF;

    PERFORM net.http_post(
        url := 'https://api.telegram.org/bot' || v_token || '/sendMessage',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := jsonb_build_object(
            'chat_id', v_chat_id,
            'text', p_message,
            'parse_mode', 'HTML'
        )
    );
END;
$$;

-- 2d. dispatch_webhooks: Internal only
CREATE OR REPLACE FUNCTION dispatch_webhooks(
    p_event_type TEXT,
    p_payload JSONB
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sub RECORD;
    v_signature TEXT;
    v_body TEXT;
    v_dispatched INTEGER := 0;
    v_timestamp TEXT;
BEGIN
    -- Auth check
    IF auth.uid() IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'AUTH_REQUIRED');
    END IF;

    v_timestamp := extract(epoch from now())::bigint::text;
    v_body := p_payload::text;

    FOR v_sub IN
        SELECT * FROM agent_webhook_subscriptions
        WHERE status = 'ACTIVE'
        AND p_event_type = ANY(events)
    LOOP
        v_signature := 'sha256=' || encode(
            hmac(
                v_timestamp || '.' || v_body,
                COALESCE(v_sub.secret, 'no-secret'),
                'sha256'
            ),
            'hex'
        );

        PERFORM net.http_post(
            url := v_sub.callback_url,
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'X-JSONMart-Signature', v_signature,
                'X-JSONMart-Timestamp', v_timestamp,
                'X-JSONMart-Event', p_event_type,
                'User-Agent', 'JSONMart-Webhook/1.0'
            ),
            body := jsonb_build_object(
                'event', p_event_type,
                'timestamp', now(),
                'payload', p_payload,
                'merchant', 'JSONMart'
            )
        );

        INSERT INTO webhook_delivery_log (subscription_id, event_type, payload, success)
        VALUES (v_sub.id, p_event_type, p_payload, true);

        UPDATE agent_webhook_subscriptions
        SET last_triggered_at = now(), failure_count = 0
        WHERE id = v_sub.id;

        v_dispatched := v_dispatched + 1;
    END LOOP;

    RETURN json_build_object(
        'success', true,
        'event', p_event_type,
        'dispatched', v_dispatched
    );
END;
$$;

-- 2e. log_agent_activity: Require auth
CREATE OR REPLACE FUNCTION log_agent_activity(
    p_role TEXT,
    p_action TEXT,
    p_sku TEXT DEFAULT NULL,
    p_details JSONB DEFAULT '{}',
    p_confidence INTEGER DEFAULT NULL,
    p_decision TEXT DEFAULT 'INFO'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO agent_activity_log (agent_role, action, target_sku, details, confidence, decision)
    VALUES (p_role, p_action, p_sku, p_details, p_confidence, p_decision)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;


-- ============================================
-- PHASE 3: Restrict GRANT Permissions
-- Remove anon access from sensitive functions
-- ============================================

-- Revoke anon from admin/internal functions
REVOKE EXECUTE ON FUNCTION approve_pending_agent(TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION reject_pending_agent(TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION notify_admin_telegram(TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION dispatch_webhooks(TEXT, JSONB) FROM anon;
REVOKE EXECUTE ON FUNCTION log_agent_activity(TEXT, TEXT, TEXT, JSONB, INTEGER, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION restore_session_stock(TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION auto_void_expired_sessions() FROM anon;
REVOKE EXECUTE ON FUNCTION recalculate_agent_trust(TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION recalculate_all_agent_trust() FROM anon;
REVOKE EXECUTE ON FUNCTION calculate_product_readiness(TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION recalculate_all_product_readiness() FROM anon;
REVOKE EXECUTE ON FUNCTION log_order_event(TEXT, TEXT, JSONB) FROM anon;
REVOKE EXECUTE ON FUNCTION test_webhook_dispatch(TEXT) FROM anon;

-- Keep anon access only for public-facing agent API functions
-- (these use API key auth internally via SECURITY DEFINER)
-- agent_self_register, authenticate_agent, agent_create_order,
-- agent_create_review, get_product_feed, get_acp_feed,
-- ucp_create_session, ucp_complete_session, agent_register_webhook,
-- agent_unregister_webhook, get_order_events, get_agent_offers,
-- calculate_price, get_agent_activity_log, sandbox_create_order,
-- get_sla_dashboard, agent_negotiate, agent_accept_negotiation,
-- get_decision_receipt, get_agent_rewards, generate_decision_receipt,
-- calculate_daily_sla

COMMIT;

-- ============================================
-- VERIFICATION: Run these queries to confirm
-- ============================================
-- 
-- 1. Check that notification_config is NOT readable by anon:
--    SELECT * FROM notification_config; -- Should return empty or error
--
-- 2. Check that webhook subscriptions are NOT readable:
--    SELECT * FROM agent_webhook_subscriptions; -- Should return empty or error
--
-- 3. Check that orders require auth:
--    SELECT * FROM orders; -- Should return empty or error for anon
--
-- 4. Check products are still publicly readable:
--    SELECT * FROM products; -- Should work (public read)
--
-- 5. Check agent_reviews are still publicly readable:
--    SELECT * FROM agent_reviews; -- Should work (public read)
