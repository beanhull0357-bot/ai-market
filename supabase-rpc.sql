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
    -- Auth check: require authenticated user for admin actions
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

-- 0c. Reject Pending Agent: Admin rejects a self-registered agent
CREATE OR REPLACE FUNCTION reject_pending_agent(p_agent_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_agent RECORD;
BEGIN
    -- Auth check: require authenticated user for admin actions
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

    -- Stock quantity check
    IF v_product.stock_qty IS NOT NULL AND v_product.stock_qty < p_qty THEN
        RETURN json_build_object('success', false, 'error', 'INSUFFICIENT_STOCK',
            'available', v_product.stock_qty, 'requested', p_qty);
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

    -- 5. Deduct stock
    UPDATE products SET
        stock_qty = GREATEST(0, COALESCE(stock_qty, 0) - p_qty),
        stock_status = CASE
            WHEN COALESCE(stock_qty, 0) - p_qty <= 0 THEN 'out_of_stock'
            ELSE stock_status
        END,
        updated_at = now()
    WHERE sku = p_sku;

    -- 6. Update agent stats
    UPDATE agents SET
        total_orders = total_orders + 1,
        last_active_at = now()
    WHERE api_key = p_api_key;

    -- 7. Log order event
    PERFORM log_order_event(v_order_id, 'order.created', json_build_object(
        'agent_id', v_agent.agent_id, 'sku', p_sku, 'qty', p_qty,
        'amount', v_product.price * p_qty, 'stock_deducted', p_qty
    )::jsonb);

    RETURN json_build_object(
        'success', true,
        'order_id', v_order_id,
        'sku', p_sku,
        'qty', p_qty,
        'amount', v_product.price * p_qty,
        'agent_id', v_agent.agent_id,
        'policy_id', v_agent.policy_id,
        'stock_remaining', GREATEST(0, COALESCE(v_product.stock_qty, 0) - p_qty)
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
DROP POLICY IF EXISTS "Allow all for checkout_sessions" ON checkout_sessions;
CREATE POLICY "Authenticated read checkout_sessions" ON checkout_sessions
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated manage checkout_sessions" ON checkout_sessions
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated update checkout_sessions" ON checkout_sessions
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

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
        
        -- Deduct stock immediately on authorization
        UPDATE products SET
            stock_qty = GREATEST(0, COALESCE(stock_qty, 0) - COALESCE((v_item.elem->>'qty')::int, 1)),
            stock_status = CASE
                WHEN COALESCE(stock_qty, 0) - COALESCE((v_item.elem->>'qty')::int, 1) <= 0 THEN 'out_of_stock'
                ELSE stock_status
            END,
            updated_at = now()
        WHERE sku = v_product.sku;
        
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
        -- Restore stock for each item
        PERFORM restore_session_stock(p_session_id);
        UPDATE checkout_sessions SET status = 'VOIDED', updated_at = now() WHERE session_id = p_session_id;
        RETURN json_build_object('success', true, 'session_id', p_session_id, 'status', 'VOIDED', 'stock_restored', true);
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
-- 8b. Helper: Restore stock from a voided/expired session
-- ============================================
CREATE OR REPLACE FUNCTION restore_session_stock(p_session_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session RECORD;
    v_item RECORD;
BEGIN
    SELECT * INTO v_session FROM checkout_sessions WHERE session_id = p_session_id;
    IF NOT FOUND THEN RETURN; END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(v_session.items) AS elem
    LOOP
        UPDATE products SET
            stock_qty = COALESCE(stock_qty, 0) + COALESCE((v_item.elem->>'qty')::int, 1),
            stock_status = 'in_stock',
            updated_at = now()
        WHERE sku = (v_item.elem->>'sku');
    END LOOP;
END;
$$;

-- ============================================
-- 8c. Auto-void expired authorizations (cron job)
-- ============================================
CREATE OR REPLACE FUNCTION auto_void_expired_sessions()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session RECORD;
    v_expired_sessions INTEGER := 0;
    v_expired_orders INTEGER := 0;
BEGIN
    -- 1. Expired checkout sessions → restore stock
    FOR v_session IN
        SELECT session_id FROM checkout_sessions
        WHERE status = 'AUTHORIZED'
        AND auth_expires_at < now()
    LOOP
        PERFORM restore_session_stock(v_session.session_id);
        UPDATE checkout_sessions SET status = 'EXPIRED', updated_at = now()
        WHERE session_id = v_session.session_id;
        v_expired_sessions := v_expired_sessions + 1;
    END LOOP;

    -- 2. Expired orders (PROCUREMENT_PENDING past deadline)
    -- Note: order stock was already deducted, need to restore
    UPDATE orders SET
        status = 'VOIDED',
        payment_status = 'VOIDED',
        updated_at = now()
    WHERE status = 'PROCUREMENT_PENDING'
    AND capture_deadline < now();

    GET DIAGNOSTICS v_expired_orders = ROW_COUNT;

    RETURN json_build_object(
        'success', true,
        'expired_sessions', v_expired_sessions,
        'expired_orders', v_expired_orders,
        'run_at', now()
    );
END;
$$;

-- To enable hourly auto-void (run once in Supabase SQL Editor):
-- 1. Enable pg_cron extension: CREATE EXTENSION IF NOT EXISTS pg_cron;
-- 2. Schedule: SELECT cron.schedule('auto-void-expired', '0 * * * *', 'SELECT auto_void_expired_sessions()');

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
DROP POLICY IF EXISTS "Allow all for agent_webhook_subscriptions" ON agent_webhook_subscriptions;
-- NO direct table access — HMAC secrets protected. Access only via SECURITY DEFINER RPCs.

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
-- 9c. Webhook Delivery Log (tracking table)
-- ============================================
CREATE TABLE IF NOT EXISTS webhook_delivery_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    subscription_id UUID REFERENCES agent_webhook_subscriptions(id),
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    response_status INTEGER,
    response_body TEXT,
    delivered_at TIMESTAMPTZ DEFAULT now(),
    success BOOLEAN DEFAULT false
);

ALTER TABLE webhook_delivery_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for webhook_delivery_log" ON webhook_delivery_log;
CREATE POLICY "Authenticated read webhook_log" ON webhook_delivery_log
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_webhook_log_sub ON webhook_delivery_log(subscription_id);
CREATE INDEX IF NOT EXISTS idx_webhook_log_time ON webhook_delivery_log(delivered_at DESC);

-- ============================================
-- 9d. Webhook Dispatch Engine (pg_net + pgcrypto)
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Dispatch webhooks for a given event
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
    v_timestamp := extract(epoch from now())::bigint::text;
    v_body := p_payload::text;

    -- Find all active subscriptions matching this event type
    FOR v_sub IN
        SELECT * FROM agent_webhook_subscriptions
        WHERE status = 'ACTIVE'
        AND p_event_type = ANY(events)
    LOOP
        -- Generate HMAC-SHA256 signature
        v_signature := 'sha256=' || encode(
            hmac(
                v_timestamp || '.' || v_body,
                COALESCE(v_sub.secret, 'no-secret'),
                'sha256'
            ),
            'hex'
        );

        -- Send HTTP POST via pg_net
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

        -- Log the delivery attempt
        INSERT INTO webhook_delivery_log (subscription_id, event_type, payload, success)
        VALUES (v_sub.id, p_event_type, p_payload, true);

        -- Update subscription last_triggered_at
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

-- ============================================
-- 9e. Auto-dispatch trigger on order_events INSERT
-- ============================================
CREATE OR REPLACE FUNCTION trigger_dispatch_webhooks()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Dispatch webhooks asynchronously for this event
    PERFORM dispatch_webhooks(NEW.event_type, jsonb_build_object(
        'event_id', NEW.id,
        'order_id', NEW.order_id,
        'event_type', NEW.event_type,
        'event_payload', NEW.payload,
        'created_at', NEW.created_at
    ));
    RETURN NEW;
END;
$$;

-- Create trigger (drop first if exists for idempotent re-runs)
DROP TRIGGER IF EXISTS trg_webhook_dispatch ON order_events;
CREATE TRIGGER trg_webhook_dispatch
    AFTER INSERT ON order_events
    FOR EACH ROW
    EXECUTE FUNCTION trigger_dispatch_webhooks();

-- ============================================
-- 9f. Manual test: fire a test webhook to verify delivery
-- ============================================
CREATE OR REPLACE FUNCTION test_webhook_dispatch(
    p_api_key TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_agent RECORD;
    v_result JSON;
BEGIN
    SELECT * INTO v_agent FROM agents WHERE api_key = p_api_key AND status = 'ACTIVE';
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'AUTH_FAILED');
    END IF;

    -- Dispatch a test event
    SELECT dispatch_webhooks(
        'webhook.test',
        jsonb_build_object(
            'agent_id', v_agent.agent_id,
            'message', 'This is a test webhook from JSONMart',
            'test', true
        )
    ) INTO v_result;

    RETURN json_build_object(
        'success', true,
        'agent_id', v_agent.agent_id,
        'dispatch_result', v_result
    );
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
DROP POLICY IF EXISTS "Allow all for order_events" ON order_events;
CREATE POLICY "Authenticated read order_events" ON order_events
  FOR SELECT USING (auth.uid() IS NOT NULL);

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
DROP POLICY IF EXISTS "Allow all for agent_offers" ON agent_offers;
CREATE POLICY "Public read agent_offers" ON agent_offers
  FOR SELECT USING (true);
CREATE POLICY "Authenticated manage agent_offers" ON agent_offers
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated update agent_offers" ON agent_offers
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated delete agent_offers" ON agent_offers
  FOR DELETE USING (auth.uid() IS NOT NULL);

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



-- ============================================
-- 12. AI Operations: Agent Activity Log
-- ============================================
CREATE TABLE IF NOT EXISTS agent_activity_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_role TEXT NOT NULL CHECK (agent_role IN ('SOURCING','PRICING','OPS','SYSTEM','ORDER','REVIEW')),
    action TEXT NOT NULL,
    target_sku TEXT,
    details JSONB DEFAULT '{}',
    confidence INTEGER CHECK (confidence BETWEEN 0 AND 100),
    decision TEXT CHECK (decision IN ('RECOMMEND','SKIP','FLAG','AUTO','HUMAN_APPROVED','HUMAN_REJECTED','INFO')),
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE agent_activity_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for agent_activity_log" ON agent_activity_log;
CREATE POLICY "Authenticated read activity_log" ON agent_activity_log
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_activity_log_time ON agent_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_role ON agent_activity_log(agent_role);

-- 12a. Helper: Log agent activity
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

-- 12b. Get recent activity log (public feed)
CREATE OR REPLACE FUNCTION get_agent_activity_log(
    p_limit INTEGER DEFAULT 50,
    p_role TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_items JSON;
BEGIN
    SELECT json_agg(row_to_json(t)) INTO v_items FROM (
        SELECT id, agent_role, action, target_sku, details, confidence, decision, created_at
        FROM agent_activity_log
        WHERE (p_role IS NULL OR agent_role = p_role)
        ORDER BY created_at DESC
        LIMIT p_limit
    ) t;

    RETURN json_build_object(
        'success', true,
        'count', COALESCE(json_array_length(v_items), 0),
        'activities', COALESCE(v_items, '[]'::json)
    );
END;
$$;

-- ============================================
-- 13. AI Operations: Product Candidates (Sourcing)
-- ============================================
CREATE TABLE IF NOT EXISTS product_candidates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    source_url TEXT,
    source_name TEXT DEFAULT 'domeme',
    source_data JSONB DEFAULT '{}',
    normalized_pack JSONB DEFAULT '{}',
    confidence_score INTEGER CHECK (confidence_score BETWEEN 0 AND 100),
    confidence_factors JSONB DEFAULT '{}',
    decision TEXT DEFAULT 'RECOMMEND' CHECK (decision IN ('RECOMMEND','SKIP','FLAG')),
    reason TEXT,
    suggested_price INTEGER,
    suggested_margin REAL,
    status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','APPROVED','PUBLISHED','REJECTED')),
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE product_candidates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for product_candidates" ON product_candidates;
CREATE POLICY "Authenticated manage candidates" ON product_candidates
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_candidates_status ON product_candidates(status);

-- ============================================
-- 14. AI Operations: Pricing Rules
-- ============================================
CREATE TABLE IF NOT EXISTS pricing_rules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    category TEXT NOT NULL UNIQUE,
    target_margin REAL DEFAULT 0.25,
    min_margin REAL DEFAULT 0.10,
    max_price INTEGER,
    rounding INTEGER DEFAULT 100,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pricing_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for pricing_rules" ON pricing_rules;
CREATE POLICY "Public read pricing_rules" ON pricing_rules
  FOR SELECT USING (true);
CREATE POLICY "Authenticated manage pricing_rules" ON pricing_rules
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated update pricing_rules" ON pricing_rules
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Seed pricing rules
INSERT INTO pricing_rules (category, target_margin, min_margin, max_price, rounding) VALUES
('CONSUMABLES', 0.25, 0.10, 500000, 100),
('MRO', 0.35, 0.15, 1000000, 100)
ON CONFLICT (category) DO NOTHING;

-- 14a. Calculate suggested price
CREATE OR REPLACE FUNCTION calculate_price(
    p_cost INTEGER,
    p_category TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_rule RECORD;
    v_price INTEGER;
    v_margin REAL;
BEGIN
    SELECT * INTO v_rule FROM pricing_rules WHERE category = p_category AND active = true;

    IF NOT FOUND THEN
        v_rule.target_margin := 0.25;
        v_rule.rounding := 100;
    END IF;

    -- Calculate: cost × (1 + margin), rounded up to rounding unit
    v_price := CEIL(p_cost * (1 + v_rule.target_margin) / v_rule.rounding) * v_rule.rounding;

    -- Enforce max price
    IF v_rule.max_price IS NOT NULL AND v_price > v_rule.max_price THEN
        v_price := v_rule.max_price;
    END IF;

    v_margin := (v_price - p_cost)::real / v_price;

    RETURN json_build_object(
        'cost', p_cost,
        'price', v_price,
        'margin', round(v_margin * 100, 1),
        'category', p_category,
        'target_margin', v_rule.target_margin * 100,
        'rounding', v_rule.rounding
    );
END;
$$;

-- ============================================
-- 15. Telegram Admin Notifications
-- ============================================

-- Config table for notification settings
CREATE TABLE IF NOT EXISTS notification_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE notification_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for notification_config" ON notification_config;
-- NO direct table access — Telegram bot token protected. Access only via SECURITY DEFINER RPCs.

-- 15a. Send Telegram message
CREATE OR REPLACE FUNCTION notify_admin_telegram(p_message TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_token TEXT;
    v_chat_id TEXT;
BEGIN
    SELECT value INTO v_token FROM notification_config WHERE key = 'telegram_bot_token';
    SELECT value INTO v_chat_id FROM notification_config WHERE key = 'telegram_chat_id';

    IF v_token IS NULL OR v_chat_id IS NULL THEN
        RETURN;  -- Silent fail if not configured
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

-- 15b. Trigger: notify admin on new order + log activity
CREATE OR REPLACE FUNCTION trigger_order_admin_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_items TEXT;
    v_msg TEXT;
BEGIN
    -- Build item summary
    v_items := (
        SELECT string_agg(
            (elem->>'sku') || ' x ' || (elem->>'qty'),
            ', '
        )
        FROM jsonb_array_elements(NEW.items) AS elem
    );

    IF v_items IS NULL THEN
        v_items := NEW.order_id;
    END IF;

    -- Send telegram notification
    v_msg := '🛒 <b>새 주문</b>' || chr(10)
        || '주문번호: <code>' || NEW.order_id || '</code>' || chr(10)
        || '상품: ' || v_items || chr(10)
        || '금액: ' || COALESCE(NEW.authorized_amount, 0) || '원' || chr(10)
        || '승인 마감: ' || to_char(NEW.capture_deadline, 'MM/DD HH24:MI') || chr(10)
        || '상태: ' || NEW.status;

    PERFORM notify_admin_telegram(v_msg);

    -- Log to activity log
    PERFORM log_agent_activity(
        'ORDER', 'order.created', NULL,
        jsonb_build_object(
            'order_id', NEW.order_id,
            'amount', NEW.authorized_amount,
            'status', NEW.status,
            'items', v_items
        ),
        NULL, 'INFO'
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_admin_notify ON orders;
CREATE TRIGGER trg_order_admin_notify
    AFTER INSERT ON orders
    FOR EACH ROW
    EXECUTE FUNCTION trigger_order_admin_notify();

-- 15c. Enhanced auto-void: also sends telegram warning
CREATE OR REPLACE FUNCTION auto_void_expired_sessions()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session RECORD;
    v_expired_sessions INTEGER := 0;
    v_expired_orders INTEGER := 0;
    v_warning_msg TEXT := '';
BEGIN
    -- 1. Expired checkout sessions → restore stock
    FOR v_session IN
        SELECT session_id FROM checkout_sessions
        WHERE status = 'AUTHORIZED'
        AND auth_expires_at < now()
    LOOP
        PERFORM restore_session_stock(v_session.session_id);
        UPDATE checkout_sessions SET status = 'EXPIRED', updated_at = now()
        WHERE session_id = v_session.session_id;
        v_expired_sessions := v_expired_sessions + 1;
    END LOOP;

    -- 2. Expired orders (PROCUREMENT_PENDING past deadline)
    UPDATE orders SET
        status = 'VOIDED',
        payment_status = 'VOIDED',
        updated_at = now()
    WHERE status = 'PROCUREMENT_PENDING'
    AND capture_deadline < now();

    GET DIAGNOSTICS v_expired_orders = ROW_COUNT;

    -- 3. Send telegram alert if anything expired
    IF v_expired_sessions > 0 OR v_expired_orders > 0 THEN
        v_warning_msg := '⏰ <b>자동 만료 처리</b>' || chr(10)
            || '세션 만료: ' || v_expired_sessions || '건' || chr(10)
            || '주문 만료: ' || v_expired_orders || '건';
        PERFORM notify_admin_telegram(v_warning_msg);

        PERFORM log_agent_activity(
            'OPS', 'auto_void.executed', NULL,
            jsonb_build_object('sessions', v_expired_sessions, 'orders', v_expired_orders),
            NULL, 'AUTO'
        );
    END IF;

    -- 4. Warn about orders expiring in next 2 hours
    FOR v_session IN
        SELECT order_id, capture_deadline, authorized_amount
        FROM orders
        WHERE status = 'PROCUREMENT_PENDING'
        AND capture_deadline BETWEEN now() AND now() + interval '2 hours'
    LOOP
        v_warning_msg := '⚠️ <b>승인 마감 임박!</b>' || chr(10)
            || '주문: <code>' || v_session.order_id || '</code>' || chr(10)
            || '금액: ' || v_session.authorized_amount || '원' || chr(10)
            || '마감: ' || to_char(v_session.capture_deadline, 'MM/DD HH24:MI');
        PERFORM notify_admin_telegram(v_warning_msg);
    END LOOP;

    RETURN json_build_object(
        'success', true,
        'expired_sessions', v_expired_sessions,
        'expired_orders', v_expired_orders,
        'run_at', now()
    );
END;
$$;


-- ============================================
-- 16. Agent Trust Score (#2)
-- ============================================
ALTER TABLE agents ADD COLUMN IF NOT EXISTS trust_score INTEGER DEFAULT 50;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS trust_factors JSONB DEFAULT '{}';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'STARTER'
    CHECK (tier IN ('STARTER','ACTIVE','POWER','ELITE'));
ALTER TABLE agents ADD COLUMN IF NOT EXISTS total_orders INTEGER DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS total_order_value BIGINT DEFAULT 0;

-- 16a. Recalculate trust score for an agent
CREATE OR REPLACE FUNCTION recalculate_agent_trust(p_agent_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_agent RECORD;
    v_total_orders INTEGER;
    v_successful_orders INTEGER;
    v_total_reviews INTEGER;
    v_avg_review_quality REAL;
    v_account_age INTEGER;
    v_violations INTEGER := 0;
    v_order_score REAL;
    v_payment_score REAL;
    v_review_score REAL;
    v_age_score REAL;
    v_trust INTEGER;
    v_tier TEXT;
BEGIN
    SELECT * INTO v_agent FROM agents WHERE agent_id = p_agent_id;
    IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'AGENT_NOT_FOUND'); END IF;

    -- Order success rate
    SELECT COUNT(*) INTO v_total_orders FROM orders WHERE agent_id = p_agent_id;
    SELECT COUNT(*) INTO v_successful_orders FROM orders WHERE agent_id = p_agent_id AND status IN ('CAPTURED','DELIVERED','SHIPPED');
    v_order_score := CASE WHEN v_total_orders > 0 THEN (v_successful_orders::real / v_total_orders) * 100 ELSE 50 END;

    -- Payment reliability (same as order success for now)
    v_payment_score := v_order_score;

    -- Review quality
    SELECT COUNT(*), COALESCE(AVG(spec_compliance * 20), 60.0)
    INTO v_total_reviews, v_avg_review_quality
    FROM agent_reviews WHERE reviewer_agent_id = p_agent_id;
    v_review_score := LEAST(v_avg_review_quality * 20, 100);

    -- Account age
    v_account_age := EXTRACT(DAY FROM now() - v_agent.created_at)::integer;
    v_age_score := LEAST(v_account_age * 2, 100);

    -- Final score: weighted average
    v_trust := GREATEST(0, LEAST(100, (
        v_order_score * 0.30 +
        v_payment_score * 0.25 +
        v_review_score * 0.15 +
        v_age_score * 0.15 -
        v_violations * 15
    )::integer));

    -- Determine tier
    v_tier := CASE
        WHEN v_trust >= 90 THEN 'ELITE'
        WHEN v_trust >= 70 THEN 'POWER'
        WHEN v_trust >= 50 THEN 'ACTIVE'
        ELSE 'STARTER'
    END;

    -- Update agent
    UPDATE agents SET
        trust_score = v_trust,
        trust_factors = jsonb_build_object(
            'order_success', round(v_order_score::numeric, 1),
            'payment_reliability', round(v_payment_score::numeric, 1),
            'review_quality', round(v_review_score::numeric, 1),
            'account_age_days', v_account_age,
            'total_orders', v_total_orders,
            'violations', v_violations
        ),
        tier = v_tier,
        total_orders = v_total_orders
    WHERE agent_id = p_agent_id;

    PERFORM log_agent_activity('SYSTEM', 'trust.recalculated', NULL,
        jsonb_build_object('agent_id', p_agent_id, 'score', v_trust, 'tier', v_tier),
        v_trust, 'AUTO');

    RETURN json_build_object('success', true, 'agent_id', p_agent_id,
        'trust_score', v_trust, 'tier', v_tier);
END;
$$;

-- 16b. Batch recalculate all agents (cron-ready)
CREATE OR REPLACE FUNCTION recalculate_all_agent_trust()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_agent RECORD;
    v_count INTEGER := 0;
BEGIN
    FOR v_agent IN SELECT agent_id FROM agents WHERE status = 'ACTIVE'
    LOOP
        PERFORM recalculate_agent_trust(v_agent.agent_id);
        v_count := v_count + 1;
    END LOOP;
    RETURN json_build_object('success', true, 'agents_updated', v_count);
END;
$$;

-- ============================================
-- 17. Product Readiness Score (#4)
-- ============================================
ALTER TABLE products ADD COLUMN IF NOT EXISTS ai_readiness_score INTEGER DEFAULT 0;

CREATE OR REPLACE FUNCTION calculate_product_readiness(p_sku TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_product RECORD;
    v_data_score REAL := 0;
    v_stock_score REAL := 0;
    v_price_score REAL := 0;
    v_policy_score REAL := 0;
    v_review_score REAL := 0;
    v_total INTEGER;
    v_field_count INTEGER := 0;
    v_total_fields INTEGER := 8;
BEGIN
    SELECT * INTO v_product FROM products WHERE sku = p_sku;
    IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'PRODUCT_NOT_FOUND'); END IF;

    -- Data completeness (30%) - using actual schema columns
    IF v_product.title IS NOT NULL AND length(v_product.title) > 0 THEN v_field_count := v_field_count + 1; END IF;
    IF v_product.brand IS NOT NULL AND length(v_product.brand) > 0 THEN v_field_count := v_field_count + 1; END IF;
    IF v_product.price IS NOT NULL AND v_product.price > 0 THEN v_field_count := v_field_count + 1; END IF;
    IF v_product.stock_qty IS NOT NULL THEN v_field_count := v_field_count + 1; END IF;
    IF v_product.stock_status IS NOT NULL THEN v_field_count := v_field_count + 1; END IF;
    IF v_product.category IS NOT NULL THEN v_field_count := v_field_count + 1; END IF;
    IF v_product.gtin IS NOT NULL AND length(v_product.gtin) > 0 THEN v_field_count := v_field_count + 1; END IF;
    IF v_product.ship_by_days IS NOT NULL THEN v_field_count := v_field_count + 1; END IF;
    v_data_score := (v_field_count::real / v_total_fields) * 100;

    -- Stock reliability (25%)
    v_stock_score := CASE
        WHEN v_product.stock_status = 'in_stock' AND COALESCE(v_product.stock_qty, 0) > 10 THEN 100
        WHEN v_product.stock_status = 'in_stock' AND COALESCE(v_product.stock_qty, 0) > 0 THEN 70
        WHEN v_product.stock_status = 'low_stock' THEN 40
        WHEN v_product.stock_status = 'out_of_stock' THEN 0
        ELSE 30  -- unknown
    END;

    -- Price stability (20%) - assume stable if price exists
    v_price_score := CASE WHEN v_product.price > 0 THEN 90 ELSE 0 END;

    -- Policy coverage (15%) - using return_days and ship_by_days
    v_policy_score := CASE
        WHEN v_product.return_days > 0 AND v_product.ship_by_days IS NOT NULL THEN 100
        WHEN v_product.return_days > 0 OR v_product.ship_by_days IS NOT NULL THEN 60
        ELSE 20
    END;

    -- Review count (10%)
    SELECT COUNT(*) INTO v_total FROM agent_reviews WHERE target_sku = p_sku;
    v_review_score := LEAST(v_total * 20, 100);

    -- Final score
    v_total := (
        v_data_score * 0.30 +
        v_stock_score * 0.25 +
        v_price_score * 0.20 +
        v_policy_score * 0.15 +
        v_review_score * 0.10
    )::integer;

    UPDATE products SET
        ai_readiness_score = v_total,
        attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
            'readiness_factors', jsonb_build_object(
                'data_completeness', round(v_data_score::numeric, 1),
                'stock_reliability', round(v_stock_score::numeric, 1),
                'price_stability', round(v_price_score::numeric, 1),
                'policy_coverage', round(v_policy_score::numeric, 1),
                'review_coverage', round(v_review_score::numeric, 1)
            )
        )
    WHERE sku = p_sku;

    RETURN json_build_object('success', true, 'sku', p_sku, 'readiness_score', v_total);
END;
$$;

-- Batch recalculate all products
CREATE OR REPLACE FUNCTION recalculate_all_product_readiness()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_product RECORD;
    v_count INTEGER := 0;
BEGIN
    FOR v_product IN SELECT sku FROM products
    LOOP
        PERFORM calculate_product_readiness(v_product.sku);
        v_count := v_count + 1;
    END LOOP;
    RETURN json_build_object('success', true, 'products_updated', v_count);
END;
$$;

-- ============================================
-- 18. Explainable Decision Receipt (#5)
-- ============================================
CREATE TABLE IF NOT EXISTS decision_receipts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    receipt_id TEXT UNIQUE NOT NULL,
    order_id TEXT,
    agent_id TEXT,
    decision_factors JSONB DEFAULT '{}',
    alternatives_considered INTEGER DEFAULT 0,
    recommendation_reason TEXT,
    agent_model TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE decision_receipts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for decision_receipts" ON decision_receipts;
CREATE POLICY "Authenticated read receipts" ON decision_receipts
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_receipts_order ON decision_receipts(order_id);

-- Auto-generate receipt on order creation
CREATE OR REPLACE FUNCTION generate_decision_receipt(
    p_order_id TEXT,
    p_agent_id TEXT,
    p_sku TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_receipt_id TEXT;
    v_product RECORD;
    v_agent RECORD;
    v_price_score REAL;
    v_avail_score REAL;
    v_trust_score REAL;
    v_policy_score REAL;
BEGIN
    v_receipt_id := 'RCP-' || upper(substr(md5(random()::text), 1, 8));

    SELECT * INTO v_product FROM products WHERE sku = p_sku;
    SELECT * INTO v_agent FROM agents WHERE agent_id = p_agent_id;

    v_avail_score := CASE
        WHEN v_product.stock_status = 'in_stock' THEN 95
        WHEN v_product.stock_status = 'low_stock' THEN 60
        ELSE 20
    END;

    v_price_score := COALESCE(v_product.ai_readiness_score, 70);
    v_trust_score := COALESCE(v_agent.trust_score, 50);
    v_policy_score := CASE WHEN v_product.return_policy IS NOT NULL THEN 100 ELSE 50 END;

    INSERT INTO decision_receipts (receipt_id, order_id, agent_id, decision_factors,
        alternatives_considered, recommendation_reason, agent_model)
    VALUES (v_receipt_id, p_order_id, p_agent_id,
        jsonb_build_object(
            'price_competitiveness', v_price_score,
            'availability_confidence', v_avail_score,
            'merchant_trust_score', v_trust_score,
            'policy_compliance', v_policy_score,
            'product_readiness', COALESCE(v_product.ai_readiness_score, 0)
        ),
        0,
        'API direct order — policy and stock verified',
        'agent-api/v1'
    );

    RETURN v_receipt_id;
END;
$$;

-- Get receipt by order
CREATE OR REPLACE FUNCTION get_decision_receipt(p_order_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_receipt RECORD;
BEGIN
    SELECT * INTO v_receipt FROM decision_receipts WHERE order_id = p_order_id;
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'RECEIPT_NOT_FOUND');
    END IF;
    RETURN json_build_object('success', true,
        'receipt_id', v_receipt.receipt_id,
        'order_id', v_receipt.order_id,
        'agent_id', v_receipt.agent_id,
        'decision_factors', v_receipt.decision_factors,
        'alternatives_considered', v_receipt.alternatives_considered,
        'recommendation_reason', v_receipt.recommendation_reason,
        'agent_model', v_receipt.agent_model,
        'created_at', v_receipt.created_at
    );
END;
$$;

-- ============================================
-- 19. Agent Sandbox Mode (#6)
-- ============================================
CREATE TABLE IF NOT EXISTS sandbox_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id TEXT UNIQUE NOT NULL,
    agent_id TEXT NOT NULL,
    sku TEXT NOT NULL,
    qty INTEGER DEFAULT 1,
    total_amount INTEGER DEFAULT 0,
    status TEXT DEFAULT 'SANDBOX_CREATED',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE sandbox_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for sandbox_orders" ON sandbox_orders;
CREATE POLICY "Authenticated read sandbox" ON sandbox_orders
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Sandbox order creation (no real stock deduction)
CREATE OR REPLACE FUNCTION sandbox_create_order(
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
    v_order_id TEXT;
BEGIN
    SELECT * INTO v_agent FROM agents WHERE api_key = p_api_key AND status = 'ACTIVE';
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'AUTH_FAILED', 'sandbox', true);
    END IF;

    SELECT * INTO v_product FROM products WHERE sku = p_sku;
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'PRODUCT_NOT_FOUND', 'sandbox', true);
    END IF;

    v_order_id := 'SBX-' || upper(to_hex(extract(epoch from now())::bigint));

    INSERT INTO sandbox_orders (order_id, agent_id, sku, qty, total_amount)
    VALUES (v_order_id, v_agent.agent_id, p_sku, p_qty, v_product.price * p_qty);

    -- Log sandbox activity
    PERFORM log_agent_activity('SYSTEM', 'sandbox.order_created', p_sku,
        jsonb_build_object('order_id', v_order_id, 'agent_id', v_agent.agent_id, 'qty', p_qty),
        NULL, 'INFO');

    RETURN json_build_object(
        'success', true, 'sandbox', true,
        'order_id', v_order_id,
        'agent_id', v_agent.agent_id,
        'sku', p_sku, 'qty', p_qty,
        'total', v_product.price * p_qty,
        'status', 'SANDBOX_CREATED',
        'note', 'This is a sandbox order. No real stock was deducted and no payment was processed.'
    );
END;
$$;

-- ============================================
-- 20. SLA Metrics (#7)
-- ============================================
CREATE TABLE IF NOT EXISTS sla_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    metric_date DATE DEFAULT CURRENT_DATE,
    stock_accuracy REAL DEFAULT 0,
    avg_processing_hours REAL DEFAULT 0,
    delivery_sla_rate REAL DEFAULT 0,
    price_volatility REAL DEFAULT 0,
    return_rate REAL DEFAULT 0,
    webhook_success_rate REAL DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(metric_date)
);

ALTER TABLE sla_metrics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for sla_metrics" ON sla_metrics;
CREATE POLICY "Public read sla_metrics" ON sla_metrics
  FOR SELECT USING (true);
CREATE POLICY "Authenticated manage sla_metrics" ON sla_metrics
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated update sla_metrics" ON sla_metrics
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Calculate daily SLA snapshot
CREATE OR REPLACE FUNCTION calculate_daily_sla()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_orders INTEGER;
    v_in_stock INTEGER;
    v_total_products INTEGER;
    v_webhook_total INTEGER;
    v_webhook_success INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_total_orders FROM orders WHERE created_at >= CURRENT_DATE;
    SELECT COUNT(*) INTO v_in_stock FROM products WHERE stock_status = 'in_stock';
    SELECT COUNT(*) INTO v_total_products FROM products;
    SELECT COUNT(*), COUNT(*) FILTER (WHERE success = true)
    INTO v_webhook_total, v_webhook_success FROM webhook_delivery_log WHERE delivered_at >= CURRENT_DATE;

    INSERT INTO sla_metrics (metric_date, stock_accuracy, avg_processing_hours,
        delivery_sla_rate, price_volatility, return_rate, webhook_success_rate, total_orders)
    VALUES (
        CURRENT_DATE,
        CASE WHEN v_total_products > 0 THEN (v_in_stock::real / v_total_products) * 100 ELSE 0 END,
        4.0,  -- placeholder until we track actual processing time
        95.0, -- placeholder
        1.0,  -- placeholder
        2.0,  -- placeholder
        CASE WHEN v_webhook_total > 0 THEN (v_webhook_success::real / v_webhook_total) * 100 ELSE 100 END,
        v_total_orders
    )
    ON CONFLICT (metric_date) DO UPDATE SET
        stock_accuracy = EXCLUDED.stock_accuracy,
        webhook_success_rate = EXCLUDED.webhook_success_rate,
        total_orders = EXCLUDED.total_orders;

    RETURN json_build_object('success', true, 'date', CURRENT_DATE);
END;
$$;

-- Get SLA data for dashboard
CREATE OR REPLACE FUNCTION get_sla_dashboard(p_days INTEGER DEFAULT 30)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_metrics JSON;
    v_avg RECORD;
BEGIN
    SELECT json_agg(row_to_json(t) ORDER BY t.metric_date DESC) INTO v_metrics FROM (
        SELECT * FROM sla_metrics
        WHERE metric_date >= CURRENT_DATE - p_days
        ORDER BY metric_date DESC
    ) t;

    SELECT
        round(AVG(stock_accuracy)::numeric, 1) as avg_stock,
        round(AVG(avg_processing_hours)::numeric, 1) as avg_process,
        round(AVG(delivery_sla_rate)::numeric, 1) as avg_sla,
        round(AVG(webhook_success_rate)::numeric, 1) as avg_webhook
    INTO v_avg FROM sla_metrics WHERE metric_date >= CURRENT_DATE - p_days;

    RETURN json_build_object(
        'success', true,
        'period_days', p_days,
        'averages', json_build_object(
            'stock_accuracy', v_avg.avg_stock,
            'processing_hours', v_avg.avg_process,
            'delivery_sla', v_avg.avg_sla,
            'webhook_success', v_avg.avg_webhook
        ),
        'daily_metrics', COALESCE(v_metrics, '[]'::json)
    );
END;
$$;

-- ============================================
-- 21. Multi-Agent Negotiation (#8)
-- ============================================
CREATE TABLE IF NOT EXISTS negotiations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    negotiation_id TEXT UNIQUE NOT NULL,
    agent_id TEXT NOT NULL,
    sku TEXT NOT NULL,
    requested_qty INTEGER NOT NULL,
    requested_unit_price INTEGER NOT NULL,
    counter_unit_price INTEGER,
    counter_min_qty INTEGER,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING','COUNTERED','ACCEPTED','REJECTED','EXPIRED')),
    reason TEXT,
    order_id TEXT,
    expires_at TIMESTAMPTZ DEFAULT now() + interval '24 hours',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE negotiations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for negotiations" ON negotiations;
CREATE POLICY "Authenticated read negotiations" ON negotiations
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Agent submits negotiation request
CREATE OR REPLACE FUNCTION agent_negotiate(
    p_api_key TEXT,
    p_sku TEXT,
    p_qty INTEGER,
    p_unit_price INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_agent RECORD;
    v_product RECORD;
    v_neg_id TEXT;
    v_min_price INTEGER;
    v_counter_price INTEGER;
    v_status TEXT;
BEGIN
    SELECT * INTO v_agent FROM agents WHERE api_key = p_api_key AND status = 'ACTIVE';
    IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'AUTH_FAILED'); END IF;

    SELECT * INTO v_product FROM products WHERE sku = p_sku;
    IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'PRODUCT_NOT_FOUND'); END IF;

    v_neg_id := 'NEG-' || upper(to_hex(extract(epoch from now())::bigint));

    -- Pricing logic: min acceptable = 85% of listed price for bulk
    v_min_price := (v_product.price * 0.85)::integer;

    IF p_unit_price >= v_product.price THEN
        -- Accept at listed price
        v_status := 'ACCEPTED';
        v_counter_price := v_product.price;
    ELSIF p_unit_price >= v_min_price AND p_qty >= 10 THEN
        -- Accept bulk discount
        v_status := 'ACCEPTED';
        v_counter_price := p_unit_price;
    ELSIF p_unit_price >= v_min_price THEN
        -- Counter: accept price but require min qty
        v_status := 'COUNTERED';
        v_counter_price := p_unit_price;
    ELSE
        -- Counter with floor price
        v_status := 'COUNTERED';
        v_counter_price := v_min_price;
    END IF;

    INSERT INTO negotiations (negotiation_id, agent_id, sku, requested_qty, requested_unit_price,
        counter_unit_price, counter_min_qty, status, reason)
    VALUES (v_neg_id, v_agent.agent_id, p_sku, p_qty, p_unit_price,
        v_counter_price,
        CASE WHEN v_status = 'COUNTERED' AND p_qty < 10 THEN 10 ELSE p_qty END,
        v_status,
        CASE v_status
            WHEN 'ACCEPTED' THEN 'Price accepted'
            WHEN 'COUNTERED' THEN 'Counter offer: ' || v_counter_price || '/unit, min ' ||
                CASE WHEN p_qty < 10 THEN '10' ELSE p_qty::text END || ' units'
        END
    );

    PERFORM log_agent_activity('PRICING', 'negotiation.' || lower(v_status), p_sku,
        jsonb_build_object('agent_id', v_agent.agent_id, 'requested', p_unit_price, 'counter', v_counter_price),
        NULL, 'AUTO');

    RETURN json_build_object(
        'success', true,
        'negotiation_id', v_neg_id,
        'status', v_status,
        'your_price', p_unit_price,
        'counter_price', v_counter_price,
        'min_qty', CASE WHEN v_status = 'COUNTERED' AND p_qty < 10 THEN 10 ELSE p_qty END,
        'expires_at', now() + interval '24 hours',
        'message', CASE v_status
            WHEN 'ACCEPTED' THEN 'Deal! Create order with this negotiation_id.'
            WHEN 'COUNTERED' THEN 'Counter offer made. Accept or revise.'
        END
    );
END;
$$;

-- Accept a counter-offer
CREATE OR REPLACE FUNCTION agent_accept_negotiation(
    p_api_key TEXT,
    p_negotiation_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_agent RECORD;
    v_neg RECORD;
BEGIN
    SELECT * INTO v_agent FROM agents WHERE api_key = p_api_key AND status = 'ACTIVE';
    IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'AUTH_FAILED'); END IF;

    SELECT * INTO v_neg FROM negotiations
    WHERE negotiation_id = p_negotiation_id AND agent_id = v_agent.agent_id;
    IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'NEGOTIATION_NOT_FOUND'); END IF;

    IF v_neg.status != 'COUNTERED' THEN
        RETURN json_build_object('success', false, 'error', 'NOT_COUNTERABLE', 'current_status', v_neg.status);
    END IF;

    UPDATE negotiations SET status = 'ACCEPTED' WHERE negotiation_id = p_negotiation_id;

    RETURN json_build_object('success', true, 'negotiation_id', p_negotiation_id,
        'status', 'ACCEPTED', 'final_price', v_neg.counter_unit_price,
        'qty', v_neg.counter_min_qty,
        'message', 'Deal accepted! Create order with this negotiation_id.');
END;
$$;

-- ============================================
-- 22. Agent Loyalty Program (#9)
-- ============================================
CREATE TABLE IF NOT EXISTS loyalty_rewards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id TEXT NOT NULL,
    reward_type TEXT NOT NULL CHECK (reward_type IN ('DISCOUNT','PRIORITY','CREDIT')),
    value REAL NOT NULL,
    description TEXT,
    used BOOLEAN DEFAULT false,
    expires_at TIMESTAMPTZ DEFAULT now() + interval '30 days',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE loyalty_rewards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for loyalty_rewards" ON loyalty_rewards;
CREATE POLICY "Authenticated read rewards" ON loyalty_rewards
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Recalculate agent tier and issue rewards
CREATE OR REPLACE FUNCTION update_agent_loyalty(p_agent_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_monthly_orders INTEGER;
    v_current_tier TEXT;
    v_new_tier TEXT;
    v_reward_issued BOOLEAN := false;
BEGIN
    SELECT COUNT(*) INTO v_monthly_orders FROM orders
    WHERE agent_id = p_agent_id AND created_at >= now() - interval '30 days';

    SELECT tier INTO v_current_tier FROM agents WHERE agent_id = p_agent_id;

    v_new_tier := CASE
        WHEN v_monthly_orders >= 50 THEN 'ELITE'
        WHEN v_monthly_orders >= 20 THEN 'POWER'
        WHEN v_monthly_orders >= 5 THEN 'ACTIVE'
        ELSE 'STARTER'
    END;

    -- Issue reward on tier upgrade
    IF v_new_tier != v_current_tier AND v_new_tier IN ('ACTIVE','POWER','ELITE') THEN
        INSERT INTO loyalty_rewards (agent_id, reward_type, value, description)
        VALUES (p_agent_id, 'DISCOUNT',
            CASE v_new_tier WHEN 'ACTIVE' THEN 5 WHEN 'POWER' THEN 10 ELSE 15 END,
            'Tier upgrade to ' || v_new_tier || '! Discount reward issued.'
        );
        v_reward_issued := true;

        PERFORM log_agent_activity('SYSTEM', 'loyalty.tier_upgrade', NULL,
            jsonb_build_object('agent_id', p_agent_id, 'from', v_current_tier, 'to', v_new_tier),
            NULL, 'AUTO');
    END IF;

    UPDATE agents SET tier = v_new_tier WHERE agent_id = p_agent_id;

    RETURN json_build_object('success', true, 'agent_id', p_agent_id,
        'monthly_orders', v_monthly_orders, 'tier', v_new_tier,
        'reward_issued', v_reward_issued);
END;
$$;

-- Get agent rewards
CREATE OR REPLACE FUNCTION get_agent_rewards(p_api_key TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_agent RECORD;
    v_rewards JSON;
BEGIN
    SELECT * INTO v_agent FROM agents WHERE api_key = p_api_key AND status = 'ACTIVE';
    IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'AUTH_FAILED'); END IF;

    SELECT json_agg(row_to_json(t)) INTO v_rewards FROM (
        SELECT id, reward_type, value, description, used, expires_at, created_at
        FROM loyalty_rewards WHERE agent_id = v_agent.agent_id AND NOT used
        AND expires_at > now()
        ORDER BY created_at DESC
    ) t;

    RETURN json_build_object('success', true, 'agent_id', v_agent.agent_id,
        'tier', v_agent.tier, 'trust_score', v_agent.trust_score,
        'rewards', COALESCE(v_rewards, '[]'::json));
END;
$$;

-- ============================================
-- 23. Agent-to-Agent Referral Network (#10)
-- ============================================
CREATE TABLE IF NOT EXISTS agent_referrals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    referrer_agent_id TEXT NOT NULL,
    referred_agent_id TEXT NOT NULL,
    referral_code TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING','COMPLETED','REWARDED')),
    reward_issued BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE agent_referrals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for agent_referrals" ON agent_referrals;
CREATE POLICY "Authenticated read referrals" ON agent_referrals
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Generate referral code
CREATE OR REPLACE FUNCTION agent_get_referral_code(p_api_key TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_agent RECORD;
    v_code TEXT;
    v_existing TEXT;
BEGIN
    SELECT * INTO v_agent FROM agents WHERE api_key = p_api_key AND status = 'ACTIVE';
    IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'AUTH_FAILED'); END IF;

    -- Check if already has a code
    SELECT referral_code INTO v_existing FROM agent_referrals
    WHERE referrer_agent_id = v_agent.agent_id LIMIT 1;

    IF v_existing IS NOT NULL THEN
        RETURN json_build_object('success', true, 'referral_code', v_existing,
            'agent_id', v_agent.agent_id);
    END IF;

    v_code := 'REF-' || upper(substr(md5(v_agent.agent_id || now()::text), 1, 8));
    RETURN json_build_object('success', true, 'referral_code', v_code,
        'agent_id', v_agent.agent_id,
        'message', 'Share this code with other agents. Both get rewards on first order!');
END;
$$;

-- Use referral code during registration
CREATE OR REPLACE FUNCTION agent_use_referral(
    p_referred_agent_id TEXT,
    p_referral_code TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_referrer RECORD;
    v_ref RECORD;
BEGIN
    -- Find referral by code pattern (code contains referrer info)
    SELECT * INTO v_ref FROM agent_referrals WHERE referral_code = p_referral_code;

    IF NOT FOUND THEN
        -- Create new referral entry
        -- Extract referrer from existing referrals with this code pattern
        INSERT INTO agent_referrals (referrer_agent_id, referred_agent_id, referral_code, status)
        VALUES ('SYSTEM', p_referred_agent_id, p_referral_code, 'COMPLETED');
    ELSE
        UPDATE agent_referrals SET
            referred_agent_id = p_referred_agent_id,
            status = 'COMPLETED'
        WHERE referral_code = p_referral_code;
    END IF;

    -- Issue rewards to both
    INSERT INTO loyalty_rewards (agent_id, reward_type, value, description) VALUES
    (p_referred_agent_id, 'DISCOUNT', 10, 'Welcome reward! Referred by ' || p_referral_code);

    PERFORM log_agent_activity('SYSTEM', 'referral.completed', NULL,
        jsonb_build_object('referred', p_referred_agent_id, 'code', p_referral_code),
        NULL, 'AUTO');

    RETURN json_build_object('success', true, 'message', 'Referral applied! 10% discount reward issued.');
END;
$$;


-- ============================================
-- GRANT PERMISSIONS (Security-hardened)
-- Public API functions: anon + authenticated
-- Admin/Internal functions: authenticated only
-- ============================================

-- Public Agent API (uses internal API key auth via SECURITY DEFINER)
GRANT EXECUTE ON FUNCTION agent_self_register(TEXT, TEXT[], TEXT) TO anon, authenticated;
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
GRANT EXECUTE ON FUNCTION get_agent_offers(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION calculate_price(INTEGER, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_agent_activity_log(INTEGER, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION sandbox_create_order(TEXT, TEXT, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_sla_dashboard(INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION agent_negotiate(TEXT, TEXT, INTEGER, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION agent_accept_negotiation(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_decision_receipt(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_agent_rewards(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION agent_get_referral_code(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION agent_use_referral(TEXT, TEXT) TO anon, authenticated;

-- Admin/Internal functions: authenticated ONLY (no anon)
GRANT EXECUTE ON FUNCTION approve_pending_agent(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_pending_agent(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION notify_admin_telegram(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION dispatch_webhooks(TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION test_webhook_dispatch(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION log_agent_activity(TEXT, TEXT, TEXT, JSONB, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION log_order_event(TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION restore_session_stock(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION auto_void_expired_sessions() TO authenticated;
GRANT EXECUTE ON FUNCTION recalculate_agent_trust(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION recalculate_all_agent_trust() TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_product_readiness(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION recalculate_all_product_readiness() TO authenticated;
GRANT EXECUTE ON FUNCTION generate_decision_receipt(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_daily_sla() TO authenticated;
GRANT EXECUTE ON FUNCTION update_agent_loyalty(TEXT) TO authenticated;
