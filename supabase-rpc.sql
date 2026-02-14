-- ============================================
-- JSONMART Agent API RPC Functions
-- Run this in Supabase SQL Editor
-- ============================================

-- 0. Agent Self-Register: Allows an agent to register itself without human account
CREATE OR REPLACE FUNCTION agent_self_register(
    p_agent_name TEXT,
    p_capabilities TEXT[] DEFAULT '{}',
    p_contact_uri TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_agent_id TEXT;
BEGIN
    -- Validate name
    IF length(trim(p_agent_name)) < 2 THEN
        RETURN json_build_object('success', false, 'error', 'INVALID_NAME', 'message', 'Agent name must be at least 2 characters');
    END IF;

    -- Generate agent ID
    v_agent_id := 'AGT-' || upper(to_hex(extract(epoch from now())::bigint));

    -- Insert as PENDING_APPROVAL (no owner, no API key yet)
    INSERT INTO agents (agent_id, name, owner_id, api_key, status, capabilities, contact_uri)
    VALUES (v_agent_id, trim(p_agent_name), NULL, NULL, 'PENDING_APPROVAL', p_capabilities, p_contact_uri);

    RETURN json_build_object(
        'success', true,
        'agent_id', v_agent_id,
        'name', trim(p_agent_name),
        'status', 'PENDING_APPROVAL',
        'message', 'Registration submitted. Awaiting admin approval. API key will be issued upon approval.'
    );
END;
$$;

-- 0b. Approve Pending Agent: Admin approves a self-registered agent
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

-- 0c. Reject Pending Agent: Admin rejects a self-registered agent
CREATE OR REPLACE FUNCTION reject_pending_agent(p_agent_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_agent RECORD;
BEGIN
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

-- 1. Authenticate Agent: Validates API key and returns agent info
CREATE OR REPLACE FUNCTION authenticate_agent(p_api_key TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_agent RECORD;
BEGIN
    SELECT agent_id, name, status, policy_id, total_orders, total_reviews
    INTO v_agent
    FROM agents
    WHERE api_key = p_api_key;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'INVALID_API_KEY');
    END IF;

    IF v_agent.status = 'PENDING_APPROVAL' THEN
        RETURN json_build_object('success', false, 'error', 'PENDING_APPROVAL', 'message', 'Agent is awaiting admin approval.');
    END IF;

    IF v_agent.status != 'ACTIVE' THEN
        RETURN json_build_object('success', false, 'error', 'AGENT_REVOKED');
    END IF;

    -- Update last_active_at
    UPDATE agents SET last_active_at = now() WHERE api_key = p_api_key;

    RETURN json_build_object(
        'success', true,
        'agent_id', v_agent.agent_id,
        'name', v_agent.name,
        'policy_id', v_agent.policy_id,
        'total_orders', v_agent.total_orders,
        'total_reviews', v_agent.total_reviews
    );
END;
$$;

-- 2. Agent Create Order: Validates API key + policy, then creates order
CREATE OR REPLACE FUNCTION agent_create_order(
    p_api_key TEXT,
    p_sku TEXT,
    p_qty INTEGER DEFAULT 1
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_agent RECORD;
    v_product RECORD;
    v_policy RECORD;
    v_order_id TEXT;
    v_violations TEXT[] := '{}';
BEGIN
    -- 1. Authenticate
    SELECT agent_id, name, status, policy_id
    INTO v_agent
    FROM agents
    WHERE api_key = p_api_key;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'INVALID_API_KEY');
    END IF;

    IF v_agent.status != 'ACTIVE' THEN
        RETURN json_build_object('success', false, 'error', 'AGENT_REVOKED');
    END IF;

    -- 2. Fetch product
    SELECT * INTO v_product FROM products WHERE sku = p_sku;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'PRODUCT_NOT_FOUND');
    END IF;

    IF v_product.stock_status = 'out_of_stock' THEN
        RETURN json_build_object('success', false, 'error', 'OUT_OF_STOCK');
    END IF;

    -- 3. Check policy constraints (if agent has a policy)
    IF v_agent.policy_id IS NOT NULL THEN
        SELECT * INTO v_policy FROM agent_policies WHERE policy_id = v_agent.policy_id;

        IF FOUND THEN
            -- Budget check
            IF v_product.price * p_qty > v_policy.max_budget THEN
                v_violations := array_append(v_violations,
                    'BUDGET_EXCEEDED: ' || (v_product.price * p_qty) || ' > ' || v_policy.max_budget);
            END IF;

            -- Delivery check
            IF v_product.eta_days > v_policy.max_delivery_days THEN
                v_violations := array_append(v_violations,
                    'DELIVERY_TOO_SLOW: ' || v_product.eta_days || 'd > ' || v_policy.max_delivery_days || 'd');
            END IF;

            -- Trust check
            IF v_product.seller_trust < v_policy.min_seller_trust THEN
                v_violations := array_append(v_violations,
                    'LOW_TRUST: ' || v_product.seller_trust || ' < ' || v_policy.min_seller_trust);
            END IF;

            -- Category check
            IF NOT (v_product.category = ANY(v_policy.allowed_categories)) THEN
                v_violations := array_append(v_violations,
                    'CATEGORY_BLOCKED: ' || v_product.category);
            END IF;

            IF array_length(v_violations, 1) > 0 THEN
                RETURN json_build_object(
                    'success', false,
                    'error', 'POLICY_VIOLATION',
                    'violations', to_json(v_violations),
                    'policy_id', v_agent.policy_id
                );
            END IF;
        END IF;
    END IF;

    -- 4. Create order
    v_order_id := 'ORD-' || upper(to_hex(extract(epoch from now())::bigint));

    INSERT INTO orders (
        order_id, status, items, payment_status, authorized_amount,
        capture_deadline, risk_stock, risk_price, risk_policy, risk_consent,
        third_party_sharing, decision_trace
    ) VALUES (
        v_order_id,
        'PROCUREMENT_PENDING',
        json_build_array(json_build_object('sku', p_sku, 'qty', p_qty, 'reasonCodes', ARRAY['api.agent_order']))::jsonb,
        'AUTHORIZED',
        v_product.price * p_qty,
        now() + interval '24 hours',
        CASE WHEN v_product.stock_status = 'in_stock' THEN 'GREEN' ELSE 'YELLOW' END,
        'GREEN', 'GREEN', 'GREEN',
        true,
        json_build_object(
            'agentId', v_agent.agent_id,
            'policyId', v_agent.policy_id,
            'method', 'API_KEY_AUTH',
            'selectedSku', p_sku,
            'reasonCodes', ARRAY['api.authenticated', 'policy.passed']
        )::jsonb
    );

    -- 5. Update agent stats
    UPDATE agents SET
        total_orders = total_orders + 1,
        last_active_at = now()
    WHERE api_key = p_api_key;

    RETURN json_build_object(
        'success', true,
        'order_id', v_order_id,
        'sku', p_sku,
        'qty', p_qty,
        'amount', v_product.price * p_qty,
        'agent_id', v_agent.agent_id,
        'policy_id', v_agent.policy_id
    );
END;
$$;

-- 3. Agent Create Review: Validates API key, then creates review
CREATE OR REPLACE FUNCTION agent_create_review(
    p_api_key TEXT,
    p_sku TEXT,
    p_verdict TEXT DEFAULT 'ENDORSE',
    p_fulfillment_delta REAL DEFAULT 0,
    p_spec_compliance REAL DEFAULT 1.0,
    p_api_latency_ms INTEGER DEFAULT 0,
    p_log JSONB DEFAULT '[]'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_agent RECORD;
    v_product RECORD;
    v_review_id TEXT;
BEGIN
    -- 1. Authenticate
    SELECT agent_id, name, status
    INTO v_agent
    FROM agents
    WHERE api_key = p_api_key;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'INVALID_API_KEY');
    END IF;

    IF v_agent.status != 'ACTIVE' THEN
        RETURN json_build_object('success', false, 'error', 'AGENT_REVOKED');
    END IF;

    -- 2. Validate product exists
    SELECT sku INTO v_product FROM products WHERE sku = p_sku;
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'PRODUCT_NOT_FOUND');
    END IF;

    -- 3. Validate verdict
    IF p_verdict NOT IN ('ENDORSE', 'WARN', 'BLOCKLIST') THEN
        RETURN json_build_object('success', false, 'error', 'INVALID_VERDICT');
    END IF;

    -- 4. Create review
    v_review_id := 'REV-' || upper(to_hex(extract(epoch from now())::bigint));

    INSERT INTO agent_reviews (
        review_id, target_sku, reviewer_agent_id,
        fulfillment_delta, spec_compliance, api_latency_ms,
        structured_log, verdict
    ) VALUES (
        v_review_id, p_sku, v_agent.agent_id,
        p_fulfillment_delta, p_spec_compliance, p_api_latency_ms,
        p_log, p_verdict
    );

    -- 5. Update agent stats
    UPDATE agents SET
        total_reviews = total_reviews + 1,
        last_active_at = now()
    WHERE api_key = p_api_key;

    RETURN json_build_object(
        'success', true,
        'review_id', v_review_id,
        'sku', p_sku,
        'verdict', p_verdict,
        'agent_id', v_agent.agent_id
    );
END;
$$;

-- 4. Product Feed: Returns all products in agent-friendly format
CREATE OR REPLACE FUNCTION get_product_feed()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_products JSON;
BEGIN
    SELECT json_agg(json_build_object(
        'id', p.sku,
        'title', p.title,
        'brand', p.brand,
        'category', p.category,
        'gtin', p.gtin,
        'price', json_build_object(
            'amount', p.price,
            'currency', p.currency
        ),
        'availability', json_build_object(
            'status', p.stock_status,
            'quantity', p.stock_qty,
            'ship_by_days', p.ship_by_days,
            'eta_days', p.eta_days
        ),
        'policies', json_build_object(
            'return_days', p.return_days,
            'return_fee', p.return_fee,
            'return_exceptions', p.return_exceptions
        ),
        'quality', json_build_object(
            'ai_readiness_score', p.ai_readiness_score,
            'seller_trust', p.seller_trust
        ),
        'attributes', p.attributes,
        'last_updated', p.updated_at
    ) ORDER BY p.ai_readiness_score DESC)
    INTO v_products
    FROM products p
    WHERE p.stock_status != 'out_of_stock';

    RETURN json_build_object(
        'success', true,
        'feed_version', '1.0',
        'generated_at', now(),
        'currency', 'KRW',
        'product_count', (SELECT count(*) FROM products WHERE stock_status != 'out_of_stock'),
        'products', COALESCE(v_products, '[]'::json)
    );
END;
$$;

-- Grant execute permissions to anon and authenticated roles
GRANT EXECUTE ON FUNCTION agent_self_register(TEXT, TEXT[], TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION approve_pending_agent(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION reject_pending_agent(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION authenticate_agent(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION agent_create_order(TEXT, TEXT, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION agent_create_review(TEXT, TEXT, TEXT, REAL, REAL, INTEGER, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_product_feed() TO anon, authenticated;
