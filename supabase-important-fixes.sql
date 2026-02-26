-- ============================================
-- JSONMART Important Fixes — Launch Readiness
-- 🔧 Run this in Supabase SQL Editor
-- ============================================
-- Created: 2026-02-26
-- Purpose: Fix Important issues I-1, I-4, I-5 from launch analysis
-- ============================================

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- I-1 FIX: get_order_status RPC
-- MCP server needs to look up orders,
-- but orders table RLS requires auth.uid()
-- This SECURITY DEFINER function bypasses RLS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION get_order_status(
    p_order_id TEXT,
    p_api_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order RECORD;
    v_agent RECORD;
    v_is_owner BOOLEAN := false;
BEGIN
    -- Validate order_id
    IF p_order_id IS NULL OR TRIM(p_order_id) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'order_id is required');
    END IF;

    -- Fetch order
    SELECT order_id, status, payment_status, payment_method,
           sku, product_title, quantity, unit_price, total_price,
           agent_id, seller_id, tracking_number, carrier,
           created_at, updated_at
    INTO v_order
    FROM orders
    WHERE order_id = p_order_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;

    -- Check if API key matches order's agent
    IF p_api_key IS NOT NULL THEN
        SELECT agent_id INTO v_agent FROM agents WHERE api_key = p_api_key AND status = 'ACTIVE';
        IF FOUND AND v_agent.agent_id = v_order.agent_id THEN
            v_is_owner := true;
        END IF;
    END IF;

    -- Return full details if owner, limited if not
    IF v_is_owner THEN
        RETURN jsonb_build_object(
            'success', true,
            'order', jsonb_build_object(
                'order_id', v_order.order_id,
                'status', v_order.status,
                'payment_status', v_order.payment_status,
                'payment_method', v_order.payment_method,
                'sku', v_order.sku,
                'product_title', v_order.product_title,
                'quantity', v_order.quantity,
                'unit_price', v_order.unit_price,
                'total_price', v_order.total_price,
                'agent_id', v_order.agent_id,
                'seller_id', v_order.seller_id,
                'tracking_number', v_order.tracking_number,
                'carrier', v_order.carrier,
                'created_at', v_order.created_at,
                'updated_at', v_order.updated_at
            )
        );
    ELSE
        -- Public: limited info (no price or agent details)
        RETURN jsonb_build_object(
            'success', true,
            'order', jsonb_build_object(
                'order_id', v_order.order_id,
                'status', v_order.status,
                'payment_status', v_order.payment_status,
                'created_at', v_order.created_at
            )
        );
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION get_order_status(TEXT, TEXT) TO anon, authenticated;


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- I-4 FIX: check_registration_status RPC
-- Agents need to check registration status 
-- after self-registration (before they have API key)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION check_registration_status(
    p_agent_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_agent RECORD;
BEGIN
    -- Validate input
    IF p_agent_id IS NULL OR TRIM(p_agent_id) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'agent_id is required');
    END IF;

    -- Lookup agent
    SELECT agent_id, name, status, 
           CASE WHEN api_key IS NOT NULL THEN true ELSE false END AS has_api_key,
           created_at
    INTO v_agent
    FROM agents
    WHERE agent_id = p_agent_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agent not found');
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'agent_id', v_agent.agent_id,
        'name', v_agent.name,
        'status', v_agent.status,
        'has_api_key', v_agent.has_api_key,
        'registered_at', v_agent.created_at,
        'message', CASE v_agent.status
            WHEN 'PENDING_APPROVAL' THEN '관리자 승인 대기 중입니다. 승인 후 API 키가 발급됩니다.'
            WHEN 'ACTIVE' THEN '승인 완료! API 키가 발급되었습니다.'
            WHEN 'SUSPENDED' THEN '계정이 일시 정지되었습니다. 관리자에게 문의하세요.'
            WHEN 'REJECTED' THEN '등록이 거절되었습니다. 관리자에게 문의하세요.'
            ELSE '상태를 확인할 수 없습니다.'
        END
    );
END;
$$;

-- Allow anon access (agents don't have auth before approval)
GRANT EXECUTE ON FUNCTION check_registration_status(TEXT) TO anon, authenticated;


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- I-5 FIX: wallet_admin_deposit RPC
-- Admin function to charge agent wallets
-- (agents cannot self-charge without a payment PG flow)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION wallet_admin_deposit(
    p_agent_id TEXT,
    p_amount BIGINT,
    p_description TEXT DEFAULT 'Admin deposit'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_balance BIGINT;
BEGIN
    -- Auth check: admin only
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'AUTH_REQUIRED');
    END IF;

    -- Validate inputs
    IF p_agent_id IS NULL OR TRIM(p_agent_id) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'agent_id is required');
    END IF;
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'amount must be positive');
    END IF;
    IF p_amount > 10000000 THEN  -- 1000만원 상한
        RETURN jsonb_build_object('success', false, 'error', 'Maximum deposit is 10,000,000 KRW');
    END IF;

    -- Verify agent exists
    IF NOT EXISTS (SELECT 1 FROM agents WHERE agent_id = p_agent_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agent not found');
    END IF;

    -- Ensure wallet exists
    INSERT INTO agent_wallets (agent_id) VALUES (p_agent_id) ON CONFLICT (agent_id) DO NOTHING;

    -- Deposit
    UPDATE agent_wallets
    SET balance = balance + p_amount,
        total_deposited = total_deposited + p_amount,
        updated_at = NOW()
    WHERE agent_id = p_agent_id
    RETURNING balance INTO v_new_balance;

    -- Log transaction
    INSERT INTO wallet_transactions (agent_id, type, amount, balance_after, description)
    VALUES (p_agent_id, 'DEPOSIT', p_amount, v_new_balance, p_description);

    RETURN jsonb_build_object(
        'success', true,
        'agent_id', p_agent_id,
        'deposited', p_amount,
        'balance', v_new_balance,
        'message', p_agent_id || '에 ' || p_amount || '원이 충전되었습니다.'
    );
END;
$$;

-- Admin only
GRANT EXECUTE ON FUNCTION wallet_admin_deposit(TEXT, BIGINT, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION wallet_admin_deposit(TEXT, BIGINT, TEXT) FROM anon;
