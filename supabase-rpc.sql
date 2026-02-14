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

-- 4. Product Feed: Returns all products with computed trust signals
CREATE OR REPLACE FUNCTION get_product_feed()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_products JSON;
BEGIN
    SELECT json_agg(feed_row ORDER BY feed_row->>'trust_score' DESC)
    INTO v_products
    FROM (
        SELECT json_build_object(
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
                'eta_days', p.eta_days,
                'stock_known', CASE WHEN p.stock_status = 'unknown' THEN false ELSE true END
            ),
            'policies', json_build_object(
                'return_days', p.return_days,
                'return_fee', p.return_fee,
                'return_exceptions', p.return_exceptions,
                'returnable', p.return_days > 0
            ),
            'quality', json_build_object(
                'ai_readiness_score', p.ai_readiness_score,
                'seller_trust', p.seller_trust,
                'review_count', COALESCE(rs.review_count, 0),
                'endorsement_rate', COALESCE(rs.endorsement_rate, 0),
                'avg_spec_compliance', COALESCE(rs.avg_spec_compliance, 0),
                'avg_fulfillment_delta_hrs', COALESCE(rs.avg_fulfillment_delta, 0),
                'trust_score', LEAST(100, GREATEST(0,
                    (p.seller_trust * 0.4) +
                    (COALESCE(rs.endorsement_rate, 0) * 0.3) +
                    (COALESCE(rs.avg_spec_compliance, 1.0) * 100 * 0.2) +
                    (CASE WHEN p.stock_status = 'in_stock' THEN 10 ELSE 0 END)
                ))
            ),
            'attributes', p.attributes,
            'last_updated', p.updated_at
        ) AS feed_row
        FROM products p
        LEFT JOIN (
            SELECT
                target_sku,
                count(*) AS review_count,
                ROUND((count(*) FILTER (WHERE verdict = 'ENDORSE')::numeric / NULLIF(count(*), 0)) * 100, 1) AS endorsement_rate,
                ROUND(avg(spec_compliance)::numeric, 3) AS avg_spec_compliance,
                ROUND(avg(fulfillment_delta)::numeric, 1) AS avg_fulfillment_delta
            FROM agent_reviews
            GROUP BY target_sku
        ) rs ON rs.target_sku = p.sku
        WHERE p.stock_status != 'out_of_stock'
    ) sub;

    RETURN json_build_object(
        'success', true,
        'feed_version', '1.1',
        'generated_at', now(),
        'currency', 'KRW',
        'product_count', (SELECT count(*) FROM products WHERE stock_status != 'out_of_stock'),
        'trust_signals', json_build_object(
            'description', 'Trust scores are computed from agent reviews, seller metrics, and stock accuracy',
            'trust_score_formula', '(seller_trust × 0.4) + (endorsement_rate × 0.3) + (spec_compliance × 0.2) + (stock_known × 0.1)',
            'max_score', 100
        ),
        'products', COALESCE(v_products, '[]'::json)
    );
END;
$$;

-- ============================================
-- 5. ACP Product Feed (ChatGPT Shopping Format)
-- ============================================
CREATE OR REPLACE FUNCTION get_acp_feed()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_items JSON;
BEGIN
    SELECT json_agg(json_build_object(
        'id', p.sku,
        'title', p.title,
        'description', p.title || ' — ' || p.brand || ' (' || p.category || ')',
        'link', 'https://beanhull0357-bot.github.io/ai-market/#/agent-console?sku=' || p.sku,
        'image_link', 'https://beanhull0357-bot.github.io/ai-market/placeholder.png',
        'availability', CASE
            WHEN p.stock_status = 'in_stock' THEN 'in_stock'
            WHEN p.stock_status = 'out_of_stock' THEN 'out_of_stock'
            ELSE 'preorder'
        END,
        'price', json_build_object(
            'value', p.price::text,
            'currency', p.currency
        ),
        'brand', p.brand,
        'gtin', COALESCE(p.gtin, ''),
        'condition', 'new',
        'product_type', p.category,
        'shipping', json_build_object(
            'country', 'KR',
            'service', 'Standard',
            'price', json_build_object('value', '0', 'currency', 'KRW'),
            'min_handling_time', p.ship_by_days,
            'max_handling_time', p.ship_by_days,
            'min_transit_time', p.eta_days - p.ship_by_days,
            'max_transit_time', p.eta_days
        ),
        'return_policy', json_build_object(
            'type', CASE WHEN p.return_days > 0 THEN 'returnable' ELSE 'non_returnable' END,
            'days_to_return', p.return_days,
            'return_fees', json_build_object('value', p.return_fee::text, 'currency', 'KRW'),
            'return_exceptions', p.return_exceptions
        ),
        'custom_attributes', json_build_object(
            'ai_readiness_score', p.ai_readiness_score,
            'seller_trust', p.seller_trust,
            'checkout_url', 'https://beanhull0357-bot.github.io/ai-market/.well-known/ucp'
        )
    ) ORDER BY p.ai_readiness_score DESC)
    INTO v_items
    FROM products p
    WHERE p.stock_status != 'out_of_stock';

    RETURN json_build_object(
        'version', '1.0',
        'format', 'acp_product_feed',
        'merchant', json_build_object(
            'name', 'JSONMart',
            'domain', 'beanhull0357-bot.github.io',
            'country', 'KR',
            'currency', 'KRW',
            'checkout_protocol', 'UCP',
            'ucp_url', 'https://beanhull0357-bot.github.io/ai-market/.well-known/ucp'
        ),
        'generated_at', now(),
        'item_count', (SELECT count(*) FROM products WHERE stock_status != 'out_of_stock'),
        'items', COALESCE(v_items, '[]'::json)
    );
END;
$$;

-- ============================================
-- 6. UCP Checkout Sessions (Table)
-- ============================================
CREATE TABLE IF NOT EXISTS checkout_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','AUTHORIZED','CAPTURED','VOIDED','EXPIRED')),
    agent_id TEXT,
    
    -- Cart
    items JSONB NOT NULL DEFAULT '[]',
    subtotal INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'KRW',
    
    -- Auth hold
    authorized_amount INTEGER DEFAULT 0,
    auth_expires_at TIMESTAMPTZ,
    
    -- Metadata
    callback_url TEXT,
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE checkout_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for checkout_sessions" ON checkout_sessions FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 7. UCP: Create Checkout Session
-- ============================================
CREATE OR REPLACE FUNCTION ucp_create_session(
    p_items JSONB,          -- [{"sku":"TISSUE-70x20","qty":2}, ...]
    p_agent_id TEXT DEFAULT NULL,
    p_callback_url TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session_id TEXT;
    v_subtotal INTEGER := 0;
    v_validated_items JSONB := '[]'::jsonb;
    v_item RECORD;
    v_product RECORD;
BEGIN
    -- Generate session ID
    v_session_id := 'SES-' || upper(substr(md5(random()::text), 1, 8));
    
    -- Validate each item
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) AS elem
    LOOP
        SELECT * INTO v_product
        FROM products
        WHERE sku = (v_item.elem->>'sku')
        AND stock_status != 'out_of_stock';
        
        IF NOT FOUND THEN
            RETURN json_build_object(
                'success', false,
                'error', 'PRODUCT_NOT_FOUND',
                'message', 'SKU not found or out of stock: ' || (v_item.elem->>'sku')
            );
        END IF;
        
        -- Check stock
        IF v_product.stock_qty IS NOT NULL AND v_product.stock_qty < COALESCE((v_item.elem->>'qty')::int, 1) THEN
            RETURN json_build_object(
                'success', false,
                'error', 'INSUFFICIENT_STOCK',
                'message', 'Not enough stock for ' || v_product.sku || '. Available: ' || v_product.stock_qty
            );
        END IF;
        
        v_subtotal := v_subtotal + (v_product.price * COALESCE((v_item.elem->>'qty')::int, 1));
        
        v_validated_items := v_validated_items || jsonb_build_object(
            'sku', v_product.sku,
            'title', v_product.title,
            'qty', COALESCE((v_item.elem->>'qty')::int, 1),
            'unit_price', v_product.price,
            'line_total', v_product.price * COALESCE((v_item.elem->>'qty')::int, 1),
            'eta_days', v_product.eta_days
        );
    END LOOP;
    
    -- Create session
    INSERT INTO checkout_sessions (session_id, status, agent_id, items, subtotal, authorized_amount, auth_expires_at, callback_url)
    VALUES (
        v_session_id,
        'AUTHORIZED',
        p_agent_id,
        v_validated_items,
        v_subtotal,
        v_subtotal,
        now() + interval '24 hours',
        p_callback_url
    );
    
    RETURN json_build_object(
        'success', true,
        'session_id', v_session_id,
        'status', 'AUTHORIZED',
        'items', v_validated_items,
        'subtotal', v_subtotal,
        'currency', 'KRW',
        'auth_hold', json_build_object(
            'amount', v_subtotal,
            'expires_at', now() + interval '24 hours'
        ),
        'next_steps', json_build_object(
            'capture', 'Call ucp_complete_session with session_id to capture payment',
            'void', 'Session auto-voids after 24h if not captured'
        )
    );
END;
$$;

-- ============================================
-- 8. UCP: Complete (Capture) Checkout Session
-- ============================================
CREATE OR REPLACE FUNCTION ucp_complete_session(
    p_session_id TEXT,
    p_action TEXT DEFAULT 'capture'  -- 'capture' or 'void'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session RECORD;
    v_order_id TEXT;
BEGIN
    SELECT * INTO v_session
    FROM checkout_sessions
    WHERE session_id = p_session_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'SESSION_NOT_FOUND');
    END IF;
    
    IF v_session.status != 'AUTHORIZED' THEN
        RETURN json_build_object(
            'success', false,
            'error', 'INVALID_STATUS',
            'message', 'Session status is ' || v_session.status || '. Expected AUTHORIZED.'
        );
    END IF;
    
    IF v_session.auth_expires_at < now() THEN
        UPDATE checkout_sessions SET status = 'EXPIRED', updated_at = now() WHERE session_id = p_session_id;
        RETURN json_build_object('success', false, 'error', 'SESSION_EXPIRED');
    END IF;
    
    IF p_action = 'void' THEN
        UPDATE checkout_sessions SET status = 'VOIDED', updated_at = now() WHERE session_id = p_session_id;
        RETURN json_build_object('success', true, 'session_id', p_session_id, 'status', 'VOIDED');
    END IF;
    
    -- Capture: create order from session
    v_order_id := 'ORD-' || upper(substr(md5(random()::text), 1, 6));
    
    INSERT INTO orders (order_id, status, items, payment_status, authorized_amount, capture_deadline)
    VALUES (
        v_order_id,
        'PAYMENT_AUTHORIZED',
        v_session.items,
        'CAPTURED',
        v_session.subtotal,
        v_session.auth_expires_at
    );
    
    UPDATE checkout_sessions SET status = 'CAPTURED', updated_at = now() WHERE session_id = p_session_id;
    
    RETURN json_build_object(
        'success', true,
        'session_id', p_session_id,
        'status', 'CAPTURED',
        'order_id', v_order_id,
        'amount', v_session.subtotal,
        'currency', 'KRW',
        'message', 'Payment captured. Order created and awaiting fulfillment.'
    );
END;
$$;

-- ============================================
-- 9. Agent Webhook Subscriptions
-- ============================================
CREATE TABLE IF NOT EXISTS agent_webhook_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id TEXT NOT NULL,
    callback_url TEXT NOT NULL,
    events TEXT[] NOT NULL DEFAULT '{order.created,order.shipped,order.delivered}',
    secret TEXT,  -- HMAC secret for signature verification
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','PAUSED','FAILED')),
    failure_count INTEGER DEFAULT 0,
    last_triggered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE agent_webhook_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for agent_webhook_subscriptions" ON agent_webhook_subscriptions FOR ALL USING (true) WITH CHECK (true);

-- 9a. Register webhook subscription
CREATE OR REPLACE FUNCTION agent_register_webhook(
    p_api_key TEXT,
    p_callback_url TEXT,
    p_events TEXT[] DEFAULT '{order.created,order.shipped,order.delivered,offer.created,price.dropped,stock.back_in}'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_agent RECORD;
    v_secret TEXT;
    v_sub_id UUID;
    v_chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    i INTEGER;
BEGIN
    -- Authenticate
    SELECT * INTO v_agent FROM agents WHERE api_key = p_api_key AND status = 'ACTIVE';
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'AUTH_FAILED');
    END IF;

    -- Generate HMAC secret
    v_secret := 'whsec_';
    FOR i IN 1..32 LOOP
        v_secret := v_secret || substr(v_chars, floor(random() * 62 + 1)::int, 1);
    END LOOP;

    INSERT INTO agent_webhook_subscriptions (agent_id, callback_url, events, secret)
    VALUES (v_agent.agent_id, p_callback_url, p_events, v_secret)
    RETURNING id INTO v_sub_id;

    RETURN json_build_object(
        'success', true,
        'subscription_id', v_sub_id,
        'agent_id', v_agent.agent_id,
        'callback_url', p_callback_url,
        'events', p_events,
        'secret', v_secret,
        'message', 'Webhook registered. Use the secret for HMAC-SHA256 signature verification of payloads.'
    );
END;
$$;

-- 9b. Unregister webhook
CREATE OR REPLACE FUNCTION agent_unregister_webhook(
    p_api_key TEXT,
    p_subscription_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_agent RECORD;
BEGIN
    SELECT * INTO v_agent FROM agents WHERE api_key = p_api_key AND status = 'ACTIVE';
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'AUTH_FAILED');
    END IF;

    DELETE FROM agent_webhook_subscriptions
    WHERE id = p_subscription_id AND agent_id = v_agent.agent_id;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'SUBSCRIPTION_NOT_FOUND');
    END IF;

    RETURN json_build_object('success', true, 'message', 'Webhook subscription removed.');
END;
$$;

-- ============================================
-- 10. Order Events Log + Polling API
-- ============================================
CREATE TABLE IF NOT EXISTS order_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'order.created','order.authorized','order.captured','order.shipped',
        'order.delivered','order.voided','order.cancelled','order.refunded'
    )),
    payload JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE order_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for order_events" ON order_events FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_order_events_created ON order_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_events_order_id ON order_events(order_id);

-- 10a. Get order events (polling endpoint)
CREATE OR REPLACE FUNCTION get_order_events(
    p_since TIMESTAMPTZ DEFAULT (now() - interval '24 hours'),
    p_order_id TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 50
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_events JSON;
BEGIN
    SELECT json_agg(json_build_object(
        'event_id', id,
        'order_id', order_id,
        'event_type', event_type,
        'payload', payload,
        'timestamp', created_at
    ) ORDER BY created_at DESC)
    INTO v_events
    FROM (
        SELECT * FROM order_events
        WHERE created_at >= p_since
        AND (p_order_id IS NULL OR order_id = p_order_id)
        ORDER BY created_at DESC
        LIMIT p_limit
    ) sub;

    RETURN json_build_object(
        'success', true,
        'since', p_since,
        'event_count', COALESCE(json_array_length(v_events), 0),
        'events', COALESCE(v_events, '[]'::json)
    );
END;
$$;

-- 10b. Helper: Log an order event (called internally when order status changes)
CREATE OR REPLACE FUNCTION log_order_event(
    p_order_id TEXT,
    p_event_type TEXT,
    p_payload JSONB DEFAULT '{}'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO order_events (order_id, event_type, payload)
    VALUES (p_order_id, p_event_type, p_payload);
END;
$$;

-- ============================================
-- 11. Agent Offers Feed (Promotions for Agents)
-- ============================================
CREATE TABLE IF NOT EXISTS agent_offers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    offer_id TEXT UNIQUE NOT NULL,
    sku TEXT REFERENCES products(sku),
    category TEXT,  -- NULL = all categories, or 'CONSUMABLES' / 'MRO'

    -- Discount
    discount_type TEXT NOT NULL CHECK (discount_type IN ('percent_discount','fixed_discount','bundle_deal','free_shipping_upgrade')),
    discount_value NUMERIC NOT NULL DEFAULT 0,

    -- Constraints (agent-computable rules)
    min_qty INTEGER DEFAULT 1,
    max_per_order INTEGER,
    max_per_month INTEGER,
    min_order_amount INTEGER DEFAULT 0,

    -- Validity
    valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
    valid_to TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
    stackable BOOLEAN DEFAULT false,

    -- Explanation for agent reasoning
    explain TEXT NOT NULL DEFAULT '',

    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','EXPIRED','PAUSED')),
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE agent_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for agent_offers" ON agent_offers FOR ALL USING (true) WITH CHECK (true);

-- 11a. Get active offers feed
CREATE OR REPLACE FUNCTION get_agent_offers(
    p_sku TEXT DEFAULT NULL,
    p_category TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_offers JSON;
BEGIN
    SELECT json_agg(json_build_object(
        'offer_id', ao.offer_id,
        'sku', ao.sku,
        'category', COALESCE(ao.category, 'ALL'),
        'product_title', p.title,
        'discount', json_build_object(
            'type', ao.discount_type,
            'value', ao.discount_value,
            'explain', ao.explain
        ),
        'constraints', json_build_object(
            'min_qty', ao.min_qty,
            'max_per_order', ao.max_per_order,
            'max_per_month', ao.max_per_month,
            'min_order_amount', ao.min_order_amount
        ),
        'validity', json_build_object(
            'from', ao.valid_from,
            'to', ao.valid_to,
            'stackable', ao.stackable
        ),
        'original_price', p.price,
        'discounted_price', CASE
            WHEN ao.discount_type = 'percent_discount' THEN ROUND(p.price * (1 - ao.discount_value / 100))
            WHEN ao.discount_type = 'fixed_discount' THEN GREATEST(0, p.price - ao.discount_value::int)
            ELSE p.price
        END
    ) ORDER BY ao.valid_to ASC)
    INTO v_offers
    FROM agent_offers ao
    LEFT JOIN products p ON ao.sku = p.sku
    WHERE ao.status = 'ACTIVE'
    AND ao.valid_from <= now()
    AND ao.valid_to >= now()
    AND (p_sku IS NULL OR ao.sku = p_sku)
    AND (p_category IS NULL OR ao.category = p_category OR ao.category IS NULL);

    RETURN json_build_object(
        'success', true,
        'feed_type', 'agent_offers',
        'generated_at', now(),
        'offer_count', COALESCE(json_array_length(v_offers), 0),
        'note', 'All offers are rule-based and agent-computable. Constraints must be validated by the agent before applying.',
        'offers', COALESCE(v_offers, '[]'::json)
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
GRANT EXECUTE ON FUNCTION get_acp_feed() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION ucp_create_session(JSONB, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION ucp_complete_session(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION agent_register_webhook(TEXT, TEXT, TEXT[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION agent_unregister_webhook(TEXT, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_order_events(TIMESTAMPTZ, TEXT, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION log_order_event(TEXT, TEXT, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_agent_offers(TEXT, TEXT) TO anon, authenticated;

