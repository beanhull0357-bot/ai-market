-- ============================================================
-- JSONMart: Wallet, Tiers, Coupons, Invoices, Predictions, Workflows
-- Run this file in Supabase SQL Editor
-- ============================================================

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 1. USAGE TIERS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS usage_tiers (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tier_name       text NOT NULL UNIQUE,          -- FREE | STARTER | PRO | ENTERPRISE
    price_krw       integer NOT NULL DEFAULT 0,    -- 월 요금 (KRW)
    calls_per_month integer NOT NULL DEFAULT 100,  -- API 호출 한도
    sort_order      integer NOT NULL DEFAULT 0,
    features        jsonb NOT NULL DEFAULT '{}',   -- { sandbox, real_orders, webhooks, a2a, priority, ... }
    perks           jsonb NOT NULL DEFAULT '{}',   -- { welcome_bonus, loyalty_rate, bulk_discount, ... }
    created_at      timestamptz DEFAULT now()
);

-- 시드 데이터: 4개 요금제
INSERT INTO usage_tiers (tier_name, price_krw, calls_per_month, sort_order, features, perks) VALUES
(
    'FREE', 0, 100, 1,
    '{"sandbox": true, "real_orders": false, "webhooks": false, "a2a": false, "priority": false}',
    '{"welcome_bonus": 5000, "loyalty_rate": 0, "bulk_discount": 0, "support": "community"}'
),
(
    'STARTER', 29000, 1000, 2,
    '{"sandbox": true, "real_orders": true, "webhooks": "basic", "a2a": false, "priority": false}',
    '{"welcome_bonus": 20000, "loyalty_rate": 1, "bulk_discount": 0, "support": "email"}'
),
(
    'PRO', 99000, 10000, 3,
    '{"sandbox": true, "real_orders": true, "webhooks": true, "a2a": true, "priority": true}',
    '{"welcome_bonus": 100000, "loyalty_rate": 3, "bulk_discount": 10, "early_access": true, "negotiation_boost": 5, "support": "priority"}'
),
(
    'ENTERPRISE', 0, 1000000, 4,
    '{"sandbox": true, "real_orders": true, "webhooks": true, "a2a": true, "priority": true, "sla_guarantee": true, "dedicated_support": true}',
    '{"welcome_bonus": 500000, "loyalty_rate": 5, "bulk_discount": 20, "early_access": true, "negotiation_boost": 15, "custom_api": true, "support": "dedicated"}'
)
ON CONFLICT (tier_name) DO NOTHING;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 2. AGENT WALLETS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS agent_wallets (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id        text NOT NULL UNIQUE REFERENCES agents(agent_id) ON DELETE CASCADE,
    balance         bigint NOT NULL DEFAULT 0,          -- 현재 잔액 (원 단위)
    total_deposited bigint NOT NULL DEFAULT 0,          -- 누적 충전액
    total_spent     bigint NOT NULL DEFAULT 0,          -- 누적 사용액
    loyalty_points  integer NOT NULL DEFAULT 0,         -- 적립 포인트
    tier_name       text NOT NULL DEFAULT 'FREE' REFERENCES usage_tiers(tier_name),
    monthly_calls_used integer NOT NULL DEFAULT 0,      -- 이번 달 API 호출 수
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id    text NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,
    type        text NOT NULL,                          -- DEPOSIT | SPEND | REFUND | BONUS | COUPON_CREDIT | LOYALTY_EARN | REVIEW_REWARD
    amount      bigint NOT NULL,                        -- 항상 양수 (방향은 type으로 결정)
    balance_after bigint NOT NULL DEFAULT 0,
    description text,
    order_id    text,
    created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_agent ON wallet_transactions(agent_id, created_at DESC);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 3. AGENT COUPONS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS agent_coupons (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_code      text NOT NULL UNIQUE,
    coupon_type      text NOT NULL DEFAULT 'PERCENT',   -- FIXED | PERCENT
    value            numeric(10,2) NOT NULL,             -- 할인액 or 할인율(%)
    description      text,
    min_order_amount bigint NOT NULL DEFAULT 0,
    max_uses         integer,                            -- NULL = 무제한
    usage_count      integer NOT NULL DEFAULT 0,
    usage_limit      integer,
    valid_from       timestamptz DEFAULT now(),
    valid_until      timestamptz,
    is_active        boolean NOT NULL DEFAULT true,
    tier_required    text,                               -- NULL = 모든 티어
    created_at       timestamptz DEFAULT now()
);

-- 샘플 쿠폰
INSERT INTO agent_coupons (coupon_code, coupon_type, value, description, min_order_amount, max_uses, usage_limit, valid_until) VALUES
('WELCOME2026',  'PERCENT', 10,  '신규 에이전트 첫 주문 10% 할인', 0,        1000, 1000, '2026-12-31 23:59:59+09'),
('BULK20',       'PERCENT', 20,  '50만원 이상 구매 시 20% 할인',   500000,   500,  500,  '2026-12-31 23:59:59+09'),
('SPRING12',     'PERCENT', 12,  '봄 시즌 특별 할인 12%',         0,        300,  300,  '2026-05-31 23:59:59+09'),
('PRO5000',      'FIXED',   5000,'PRO 전용 ₩5,000 할인쿠폰',     30000,    null, null, null),
('REVIEWREWARD', 'FIXED',   500, '리뷰 작성 보상 ₩500 크레딧',   0,        null, null, null)
ON CONFLICT (coupon_code) DO NOTHING;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 4. INVOICES
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS invoices (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id  text NOT NULL UNIQUE DEFAULT ('INV-' || upper(substring(gen_random_uuid()::text, 1, 8))),
    agent_id    text NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,
    order_id    text,
    subtotal    bigint NOT NULL DEFAULT 0,
    discount    bigint NOT NULL DEFAULT 0,
    total       bigint NOT NULL DEFAULT 0,
    coupon_code text,
    items       jsonb NOT NULL DEFAULT '[]',
    status      text NOT NULL DEFAULT 'PAID',           -- PAID | PENDING | CANCELLED
    issued_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_agent ON invoices(agent_id, issued_at DESC);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 5. PURCHASE PREDICTIONS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS purchase_predictions (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id         text NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,
    sku              text NOT NULL,
    product_title    text,
    predicted_date   date NOT NULL,
    avg_interval_days numeric(6,1),
    total_orders     integer NOT NULL DEFAULT 0,
    avg_quantity     numeric(6,2) NOT NULL DEFAULT 1,
    estimated_amount bigint NOT NULL DEFAULT 0,
    confidence       numeric(4,3) NOT NULL DEFAULT 0.5,  -- 0.0~1.0
    status           text NOT NULL DEFAULT 'PENDING',   -- PENDING | NOTIFIED | ORDERED | EXPIRED
    created_at       timestamptz DEFAULT now(),
    updated_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_predictions_agent ON purchase_predictions(agent_id, predicted_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_predictions_agent_sku ON purchase_predictions(agent_id, sku);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 6. WORKFLOWS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS workflows (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id text NOT NULL UNIQUE,                    -- WF-XXXXX (사용자 표시용)
    agent_id    text,                                    -- NULL = 공개 워크플로우
    name        text NOT NULL,
    nodes       jsonb NOT NULL DEFAULT '[]',
    edges       jsonb NOT NULL DEFAULT '[]',
    last_sim_result jsonb,                               -- 마지막 시뮬레이션 결과
    created_at  timestamptz DEFAULT now(),
    updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflows_agent ON workflows(agent_id, updated_at DESC);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 7. RPC: get_wallet_info
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION get_wallet_info(p_api_key text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_agent     record;
    v_wallet    agent_wallets%ROWTYPE;
    v_tier      usage_tiers%ROWTYPE;
    v_txs       jsonb;
BEGIN
    -- 에이전트 인증
    SELECT * INTO v_agent FROM agents WHERE api_key = p_api_key AND status = 'ACTIVE' LIMIT 1;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_KEY');
    END IF;

    -- 지갑 upsert (처음 조회 시 생성)
    INSERT INTO agent_wallets (agent_id)
    VALUES (v_agent.agent_id)
    ON CONFLICT (agent_id) DO NOTHING;

    SELECT * INTO v_wallet FROM agent_wallets WHERE agent_id = v_agent.agent_id;

    -- 웰컴 보너스 지급 (첫 조회 + FREE 티어 + 잔액 0)
    IF v_wallet.balance = 0 AND v_wallet.total_deposited = 0 THEN
        SELECT * INTO v_tier FROM usage_tiers WHERE tier_name = v_wallet.tier_name;
        IF (v_tier.perks->>'welcome_bonus')::bigint > 0 THEN
            UPDATE agent_wallets
            SET balance = (v_tier.perks->>'welcome_bonus')::bigint,
                total_deposited = (v_tier.perks->>'welcome_bonus')::bigint,
                updated_at = now()
            WHERE agent_id = v_agent.agent_id;

            INSERT INTO wallet_transactions (agent_id, type, amount, balance_after, description)
            VALUES (v_agent.agent_id, 'BONUS', (v_tier.perks->>'welcome_bonus')::bigint,
                    (v_tier.perks->>'welcome_bonus')::bigint, '🎁 가입 환영 보너스');

            SELECT * INTO v_wallet FROM agent_wallets WHERE agent_id = v_agent.agent_id;
        END IF;
    END IF;

    SELECT * INTO v_tier FROM usage_tiers WHERE tier_name = v_wallet.tier_name;

    -- 최근 50건 거래 내역
    SELECT jsonb_agg(t ORDER BY t.created_at DESC) INTO v_txs
    FROM (
        SELECT * FROM wallet_transactions
        WHERE agent_id = v_agent.agent_id
        ORDER BY created_at DESC LIMIT 50
    ) t;

    RETURN jsonb_build_object(
        'success', true,
        'wallet', jsonb_build_object(
            'agent_id',       v_wallet.agent_id,
            'balance',        v_wallet.balance,
            'total_deposited',v_wallet.total_deposited,
            'total_spent',    v_wallet.total_spent,
            'loyalty_points', v_wallet.loyalty_points,
            'tier_name',      v_wallet.tier_name
        ),
        'tier', jsonb_build_object(
            'name',              v_tier.tier_name,
            'calls_per_month',   v_tier.calls_per_month,
            'monthly_calls_used',v_wallet.monthly_calls_used
        ),
        'transactions', COALESCE(v_txs, '[]'::jsonb)
    );
END;
$$;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 8. RPC: wallet_deposit
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION wallet_deposit(
    p_api_key   text,
    p_amount    bigint,
    p_description text DEFAULT '크레딧 충전'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_agent  record;
    v_new_balance bigint;
BEGIN
    IF p_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_AMOUNT');
    END IF;

    SELECT * INTO v_agent FROM agents WHERE api_key = p_api_key AND status = 'ACTIVE' LIMIT 1;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_KEY');
    END IF;

    -- 지갑 upsert
    INSERT INTO agent_wallets (agent_id) VALUES (v_agent.agent_id) ON CONFLICT (agent_id) DO NOTHING;

    UPDATE agent_wallets
    SET balance = balance + p_amount,
        total_deposited = total_deposited + p_amount,
        updated_at = now()
    WHERE agent_id = v_agent.agent_id
    RETURNING balance INTO v_new_balance;

    -- 적립 포인트: 1,000원당 1포인트
    UPDATE agent_wallets
    SET loyalty_points = loyalty_points + (p_amount / 1000)
    WHERE agent_id = v_agent.agent_id;

    INSERT INTO wallet_transactions (agent_id, type, amount, balance_after, description)
    VALUES (v_agent.agent_id, 'DEPOSIT', p_amount, v_new_balance, p_description);

    RETURN jsonb_build_object(
        'success', true,
        'new_balance', v_new_balance,
        'deposited', p_amount
    );
END;
$$;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 9. RPC: wallet_spend
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION wallet_spend(
    p_api_key text,
    p_amount  bigint,
    p_order_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_agent       record;
    v_wallet      agent_wallets%ROWTYPE;
    v_new_balance bigint;
BEGIN
    SELECT * INTO v_agent FROM agents WHERE api_key = p_api_key AND status = 'ACTIVE' LIMIT 1;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'INVALID_KEY'); END IF;

    SELECT * INTO v_wallet FROM agent_wallets WHERE agent_id = v_agent.agent_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'NO_WALLET'); END IF;
    IF v_wallet.balance < p_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'INSUFFICIENT_BALANCE', 'balance', v_wallet.balance);
    END IF;

    UPDATE agent_wallets
    SET balance = balance - p_amount, total_spent = total_spent + p_amount, updated_at = now()
    WHERE agent_id = v_agent.agent_id
    RETURNING balance INTO v_new_balance;

    INSERT INTO wallet_transactions (agent_id, type, amount, balance_after, description, order_id)
    VALUES (v_agent.agent_id, 'SPEND', p_amount, v_new_balance,
            COALESCE('주문 결제: ' || p_order_id, '크레딧 사용'), p_order_id);

    RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 10. RPC: wallet_refund
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION wallet_refund(
    p_api_key  text,
    p_order_id text,
    p_amount   bigint DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_agent       record;
    v_spend_tx    wallet_transactions%ROWTYPE;
    v_refund_amt  bigint;
    v_new_balance bigint;
BEGIN
    SELECT * INTO v_agent FROM agents WHERE api_key = p_api_key AND status = 'ACTIVE' LIMIT 1;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'INVALID_KEY'); END IF;

    -- 원래 결제 금액 찾기
    SELECT * INTO v_spend_tx FROM wallet_transactions
    WHERE agent_id = v_agent.agent_id AND order_id = p_order_id AND type = 'SPEND'
    ORDER BY created_at DESC LIMIT 1;

    v_refund_amt := CASE WHEN p_amount > 0 THEN p_amount ELSE COALESCE(v_spend_tx.amount, 0) END;
    IF v_refund_amt <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'NO_REFUND_AMOUNT');
    END IF;

    UPDATE agent_wallets
    SET balance = balance + v_refund_amt, total_spent = GREATEST(0, total_spent - v_refund_amt), updated_at = now()
    WHERE agent_id = v_agent.agent_id
    RETURNING balance INTO v_new_balance;

    INSERT INTO wallet_transactions (agent_id, type, amount, balance_after, description, order_id)
    VALUES (v_agent.agent_id, 'REFUND', v_refund_amt, v_new_balance, '환불: ' || p_order_id, p_order_id);

    RETURN jsonb_build_object('success', true, 'refunded', v_refund_amt, 'new_balance', v_new_balance);
END;
$$;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 11. RPC: apply_coupon
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION apply_coupon(
    p_api_key     text,
    p_coupon_code text,
    p_order_amount bigint,
    p_order_id    text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_agent  record;
    v_coupon agent_coupons%ROWTYPE;
    v_discount bigint;
BEGIN
    SELECT * INTO v_agent FROM agents WHERE api_key = p_api_key AND status = 'ACTIVE' LIMIT 1;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'INVALID_KEY'); END IF;

    SELECT * INTO v_coupon FROM agent_coupons WHERE coupon_code = upper(p_coupon_code) AND is_active = true;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'INVALID_COUPON'); END IF;

    -- 만료 체크
    IF v_coupon.valid_until IS NOT NULL AND v_coupon.valid_until < now() THEN
        RETURN jsonb_build_object('success', false, 'error', 'COUPON_EXPIRED');
    END IF;

    -- 최소 주문 금액 체크
    IF p_order_amount < v_coupon.min_order_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'MIN_ORDER_AMOUNT',
            'required', v_coupon.min_order_amount);
    END IF;

    -- 사용 횟수 체크
    IF v_coupon.usage_limit IS NOT NULL AND v_coupon.usage_count >= v_coupon.usage_limit THEN
        RETURN jsonb_build_object('success', false, 'error', 'COUPON_EXHAUSTED');
    END IF;

    -- 할인 금액 계산
    IF v_coupon.coupon_type = 'FIXED' THEN
        v_discount := v_coupon.value::bigint;
    ELSE
        v_discount := (p_order_amount * v_coupon.value / 100)::bigint;
    END IF;

    -- 쿠폰 사용 횟수 증가
    UPDATE agent_coupons SET usage_count = usage_count + 1 WHERE id = v_coupon.id;

    -- 쿠폰 크레딧을 지갑에 추가
    IF v_discount > 0 THEN
        UPDATE agent_wallets
        SET balance = balance + v_discount, updated_at = now()
        WHERE agent_id = v_agent.agent_id;

        INSERT INTO wallet_transactions (agent_id, type, amount, balance_after, description, order_id)
        SELECT v_agent.agent_id, 'COUPON_CREDIT', v_discount, balance,
               '쿠폰 할인: ' || p_coupon_code, p_order_id
        FROM agent_wallets WHERE agent_id = v_agent.agent_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'discount', v_discount,
        'final_amount', GREATEST(0, p_order_amount - v_discount),
        'coupon_type', v_coupon.coupon_type
    );
END;
$$;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 12. RPC: generate_invoice
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION generate_invoice(
    p_api_key    text,
    p_order_id   text,
    p_items      jsonb,
    p_coupon_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_agent    record;
    v_subtotal bigint;
    v_discount bigint := 0;
    v_coupon   agent_coupons%ROWTYPE;
    v_inv_id   text;
BEGIN
    SELECT * INTO v_agent FROM agents WHERE api_key = p_api_key AND status = 'ACTIVE' LIMIT 1;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'INVALID_KEY'); END IF;

    -- 소계 계산
    SELECT COALESCE(SUM((item->>'price')::bigint * (item->>'qty')::int), 0)
    INTO v_subtotal FROM jsonb_array_elements(p_items) item;

    -- 쿠폰 할인
    IF p_coupon_code IS NOT NULL THEN
        SELECT * INTO v_coupon FROM agent_coupons WHERE coupon_code = upper(p_coupon_code) AND is_active = true;
        IF FOUND THEN
            IF v_coupon.coupon_type = 'FIXED' THEN v_discount := v_coupon.value::bigint;
            ELSE v_discount := (v_subtotal * v_coupon.value / 100)::bigint; END IF;
        END IF;
    END IF;

    v_inv_id := 'INV-' || upper(substring(gen_random_uuid()::text, 1, 8));

    INSERT INTO invoices (invoice_id, agent_id, order_id, subtotal, discount, total, coupon_code, items)
    VALUES (v_inv_id, v_agent.agent_id, p_order_id, v_subtotal, v_discount,
            GREATEST(0, v_subtotal - v_discount), p_coupon_code, p_items);

    RETURN jsonb_build_object(
        'success', true,
        'invoice_id', v_inv_id,
        'subtotal', v_subtotal,
        'discount', v_discount,
        'total', GREATEST(0, v_subtotal - v_discount)
    );
END;
$$;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 13. RPC: generate_predictions
-- 에이전트 주문 이력을 분석하여 다음 구매 예측
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION generate_predictions(p_api_key text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_agent      record;
    v_count      integer := 0;
BEGIN
    SELECT * INTO v_agent FROM agents WHERE api_key = p_api_key AND status = 'ACTIVE' LIMIT 1;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'INVALID_KEY'); END IF;

    -- 주문 이력에서 SKU별 패턴 분석 (2회 이상 주문한 SKU 대상)
    WITH order_stats AS (
        SELECT
            o.sku,
            p.title AS product_title,
            COUNT(*) AS total_orders,
            AVG(o.quantity) AS avg_quantity,
            AVG(o.unit_price * o.quantity) AS avg_amount,
            -- 주문 간격 (일 단위)
            CASE
                WHEN COUNT(*) > 1 THEN
                    EXTRACT(EPOCH FROM (MAX(o.created_at) - MIN(o.created_at))) / 86400.0 / (COUNT(*) - 1)
                ELSE 30
            END AS avg_interval_days,
            MAX(o.created_at) AS last_ordered_at
        FROM orders o
        LEFT JOIN products p ON p.sku = o.sku
        WHERE o.agent_id = v_agent.agent_id
          AND o.procurement_status NOT IN ('cancelled', 'returned')
        GROUP BY o.sku, p.title
        HAVING COUNT(*) >= 1  -- 1회 이상 주문 (첫 예측 포함)
    )
    INSERT INTO purchase_predictions (
        agent_id, sku, product_title, predicted_date,
        avg_interval_days, total_orders, avg_quantity, estimated_amount, confidence
    )
    SELECT
        v_agent.agent_id,
        s.sku,
        s.product_title,
        -- 예측 날짜: 마지막 주문일 + 평균 주기
        (s.last_ordered_at + (s.avg_interval_days || ' days')::interval)::date,
        ROUND(s.avg_interval_days::numeric, 1),
        s.total_orders::int,
        ROUND(s.avg_quantity::numeric, 2),
        ROUND(s.avg_amount)::bigint,
        -- 신뢰도: 주문횟수 많을수록 높음, 최대 0.97
        LEAST(0.97, 0.4 + (s.total_orders * 0.15))
    FROM order_stats s
    ON CONFLICT (agent_id, sku) DO UPDATE SET
        predicted_date     = EXCLUDED.predicted_date,
        avg_interval_days  = EXCLUDED.avg_interval_days,
        total_orders       = EXCLUDED.total_orders,
        avg_quantity       = EXCLUDED.avg_quantity,
        estimated_amount   = EXCLUDED.estimated_amount,
        confidence         = EXCLUDED.confidence,
        status             = 'PENDING',
        updated_at         = now();

    GET DIAGNOSTICS v_count = ROW_COUNT;

    RETURN jsonb_build_object('success', true, 'predictions_count', v_count);
END;
$$;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 14. RPC: get_public_analytics (확장)
-- 기존 RPC가 없으면 생성
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION get_public_analytics()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_agents    bigint;
    v_sellers   bigint;
    v_products  bigint;
    v_orders    bigint;
    v_reviews   bigint;
    v_a2a       bigint;
    v_recent7   bigint;
    v_trust_avg numeric;
    v_tier_dist jsonb;
    v_cat_dist  jsonb;
BEGIN
    SELECT COUNT(*) INTO v_agents   FROM agents  WHERE status = 'ACTIVE';
    SELECT COUNT(*) INTO v_sellers  FROM sellers WHERE status = 'ACTIVE';
    SELECT COUNT(*) INTO v_products FROM products;
    SELECT COUNT(*) INTO v_orders   FROM orders;
    SELECT COUNT(*) INTO v_reviews  FROM agent_reviews;
    SELECT COUNT(*) INTO v_a2a      FROM a2a_queries;
    SELECT COUNT(*) INTO v_recent7  FROM orders WHERE created_at >= now() - interval '7 days';
    SELECT ROUND(AVG(trust_score), 1) INTO v_trust_avg FROM agents WHERE status = 'ACTIVE';

    -- 티어 분포
    SELECT jsonb_object_agg(tier_name, cnt) INTO v_tier_dist
    FROM (
        SELECT aw.tier_name, COUNT(*) AS cnt
        FROM agent_wallets aw
        GROUP BY aw.tier_name
    ) t;

    -- 카테고리 분포
    SELECT jsonb_object_agg(category, cnt) INTO v_cat_dist
    FROM (
        SELECT category, COUNT(*) AS cnt
        FROM products
        GROUP BY category ORDER BY cnt DESC LIMIT 10
    ) c;

    RETURN jsonb_build_object(
        'analytics', jsonb_build_object(
            'total_agents',       v_agents,
            'total_sellers',      v_sellers,
            'total_products',     v_products,
            'total_orders',       v_orders,
            'total_reviews',      v_reviews,
            'total_a2a_queries',  v_a2a,
            'recent_orders_7d',   v_recent7,
            'avg_trust_score',    COALESCE(v_trust_avg, 0),
            'tier_distribution',  COALESCE(v_tier_dist, '{}'::jsonb),
            'category_distribution', COALESCE(v_cat_dist, '{}'::jsonb),
            'generated_at',       now()
        )
    );
END;
$$;

-- RLS 정책 (필요 시)
ALTER TABLE agent_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;

-- 서비스 키로 모든 접근 허용 (RPC SECURITY DEFINER 사용이므로 anon도 허용)
CREATE POLICY "allow_all_wallets"        ON agent_wallets         FOR ALL USING (true);
CREATE POLICY "allow_all_wallet_txs"     ON wallet_transactions   FOR ALL USING (true);
CREATE POLICY "allow_all_coupons_read"   ON agent_coupons         FOR SELECT USING (true);
CREATE POLICY "allow_all_invoices"       ON invoices              FOR ALL USING (true);
CREATE POLICY "allow_all_predictions"    ON purchase_predictions  FOR ALL USING (true);
CREATE POLICY "allow_all_workflows"      ON workflows             FOR ALL USING (true);
CREATE POLICY "allow_all_usage_tiers"    ON usage_tiers           FOR SELECT USING (true);

-- anon 역할에 RPC 실행 권한 부여
GRANT EXECUTE ON FUNCTION get_wallet_info(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION wallet_deposit(text, bigint, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION wallet_spend(text, bigint, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION wallet_refund(text, text, bigint) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION apply_coupon(text, text, bigint, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION generate_invoice(text, text, jsonb, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION generate_predictions(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_public_analytics() TO anon, authenticated;
