-- ============================================================
-- JSONMart P1-P7: Webhook, AutoReorder, Promotions, Negotiations
-- Run this in Supabase SQL Editor AFTER supabase-wallet-tiers-predictions.sql
-- ============================================================

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 1. WEBHOOK CONFIGS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS webhook_configs (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id        text REFERENCES agents(agent_id) ON DELETE CASCADE,
    webhook_id      text NOT NULL UNIQUE DEFAULT ('WH-' || upper(substring(gen_random_uuid()::text, 1, 8))),
    url             text NOT NULL,
    events          text[] NOT NULL DEFAULT '{}',
    secret          text NOT NULL DEFAULT ('whsec_' || replace(gen_random_uuid()::text, '-', '')),
    active          boolean NOT NULL DEFAULT true,
    last_triggered  timestamptz,
    fail_count      integer NOT NULL DEFAULT 0,
    created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_agent ON webhook_configs(agent_id);

ALTER TABLE webhook_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_webhooks" ON webhook_configs FOR ALL USING (true);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 2. AUTO REORDER RULES
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS auto_reorder_rules (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id         text NOT NULL UNIQUE DEFAULT ('AR-' || upper(substring(gen_random_uuid()::text, 1, 8))),
    agent_id        text NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,
    sku             text NOT NULL,
    product_name    text,
    quantity        integer NOT NULL DEFAULT 1,
    interval_days   integer NOT NULL DEFAULT 30,
    next_order_date date,
    enabled         boolean NOT NULL DEFAULT true,
    price_threshold bigint,
    total_executed  integer NOT NULL DEFAULT 0,
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now(),
    UNIQUE(agent_id, sku)
);

CREATE INDEX IF NOT EXISTS idx_reorder_agent ON auto_reorder_rules(agent_id, next_order_date);

ALTER TABLE auto_reorder_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_reorder" ON auto_reorder_rules FOR ALL USING (true);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 3. PROMOTIONS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS promotions (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    promo_id    text NOT NULL UNIQUE DEFAULT ('P-' || upper(substring(gen_random_uuid()::text, 1, 6))),
    name        text NOT NULL,
    type        text NOT NULL DEFAULT 'PERCENT_OFF',   -- PERCENT_OFF | FIXED_OFF | BULK_DISCOUNT
    value       numeric(10,2) NOT NULL,
    min_qty     integer NOT NULL DEFAULT 1,
    categories  text[] NOT NULL DEFAULT '{}',
    valid_from  date NOT NULL DEFAULT CURRENT_DATE,
    valid_to    date NOT NULL DEFAULT (CURRENT_DATE + 30),
    active      boolean NOT NULL DEFAULT true,
    created_at  timestamptz DEFAULT now()
);

ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_promotions" ON promotions FOR ALL USING (true);

-- 시드 데이터
INSERT INTO promotions (name, type, value, min_qty, categories, valid_from, valid_to, active) VALUES
('소모품 10% 할인',    'PERCENT_OFF',  10,   5,  ARRAY['CONSUMABLES'], '2026-02-01', '2026-03-31', true),
('MRO 대량 구매 15%', 'BULK_DISCOUNT', 15,  20,  ARRAY['MRO'],         '2026-02-01', '2026-04-30', true),
('전 상품 ₩5,000 할인','FIXED_OFF',  5000,   1,  ARRAY[]::text[],      '2026-01-15', '2026-02-15', false)
ON CONFLICT DO NOTHING;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 4. NEGOTIATIONS (협상 결과 저장)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS negotiations (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    negotiation_id    text NOT NULL UNIQUE,
    agent_id          text REFERENCES agents(agent_id) ON DELETE SET NULL,
    sku               text NOT NULL,
    product_title     text,
    list_price        bigint NOT NULL,
    final_price       bigint,
    policy_budget     bigint,
    buyer_agent_id    text,
    seller_agent_id   text,
    status            text NOT NULL DEFAULT 'PENDING',  -- PENDING | AGREED | REJECTED
    rounds            jsonb NOT NULL DEFAULT '[]',
    max_rounds        integer NOT NULL DEFAULT 5,
    savings_pct       numeric(5,2),
    created_at        timestamptz DEFAULT now(),
    completed_at      timestamptz
);

CREATE INDEX IF NOT EXISTS idx_negotiations_agent ON negotiations(agent_id, created_at DESC);

ALTER TABLE negotiations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_negotiations" ON negotiations FOR ALL USING (true);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 5. RPC: execute_reorder_rule
--    실제 orders 테이블에 주문 삽입 + 다음 주문일 갱신
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION execute_reorder_rule(p_rule_id text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_rule  auto_reorder_rules%ROWTYPE;
    v_product record;
    v_order_id text;
    v_total bigint;
BEGIN
    SELECT * INTO v_rule FROM auto_reorder_rules WHERE rule_id = p_rule_id AND enabled = true;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'RULE_NOT_FOUND');
    END IF;

    -- 상품 가격 조회
    SELECT offer->>'price' AS price, title INTO v_product
    FROM products WHERE sku = v_rule.sku LIMIT 1;

    v_total := COALESCE((v_product.price)::bigint, 0) * v_rule.quantity;

    -- 가격 상한 체크
    IF v_rule.price_threshold IS NOT NULL AND v_total > v_rule.price_threshold * v_rule.quantity THEN
        RETURN jsonb_build_object('success', false, 'error', 'PRICE_ABOVE_THRESHOLD', 'current', v_total);
    END IF;

    -- 주문 ID 생성
    v_order_id := 'ORD-AR-' || upper(substring(gen_random_uuid()::text, 1, 8));

    -- orders 테이블 INSERT
    INSERT INTO orders (
        order_id, agent_id, sku, quantity, unit_price, total_price, procurement_status
    ) VALUES (
        v_order_id, v_rule.agent_id, v_rule.sku,
        v_rule.quantity,
        COALESCE((v_product.price)::bigint, 0),
        v_total,
        'pending'
    );

    -- 규칙 갱신 (다음 주문일, 실행횟수)
    UPDATE auto_reorder_rules
    SET total_executed  = total_executed + 1,
        next_order_date = CURRENT_DATE + (interval_days || ' days')::interval,
        updated_at      = now()
    WHERE rule_id = p_rule_id;

    RETURN jsonb_build_object(
        'success',   true,
        'order_id',  v_order_id,
        'total',     v_total
    );
END;
$$;

GRANT EXECUTE ON FUNCTION execute_reorder_rule(text) TO anon, authenticated;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- GRANT 추가
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

GRANT EXECUTE ON FUNCTION execute_reorder_rule(text) TO anon, authenticated;
