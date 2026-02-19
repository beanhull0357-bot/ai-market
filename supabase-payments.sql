-- ============================================
-- Features ⑥-⑫: Payments, Tiers, Predictions, Multi-lang
-- Run this in Supabase SQL Editor
-- ============================================

-- ━━━ 1. Agent Virtual Wallets (가상 지갑) ━━━
CREATE TABLE IF NOT EXISTS agent_wallets (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id        TEXT UNIQUE NOT NULL,
    balance         BIGINT DEFAULT 0,              -- 현재 잔액 (KRW)
    total_deposited BIGINT DEFAULT 0,              -- 누적 충전
    total_spent     BIGINT DEFAULT 0,              -- 누적 사용
    total_refunded  BIGINT DEFAULT 0,              -- 누적 환불
    loyalty_points  INT DEFAULT 0,                 -- 적립 포인트
    welcome_bonus   BOOLEAN DEFAULT false,         -- 가입 보너스 지급 여부
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ━━━ 2. Wallet Transactions (거래 내역) ━━━
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id        TEXT NOT NULL,
    type            TEXT NOT NULL CHECK (type IN (
        'DEPOSIT','SPEND','REFUND','BONUS',
        'COUPON_CREDIT','LOYALTY_EARN','LOYALTY_REDEEM',
        'REFERRAL_BONUS','REVIEW_REWARD','TIER_UPGRADE_BONUS'
    )),
    amount          BIGINT NOT NULL,
    balance_after   BIGINT NOT NULL DEFAULT 0,
    order_id        TEXT,
    description     TEXT,
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ━━━ 3. Agent Coupons (쿠폰 시스템) ━━━
CREATE TABLE IF NOT EXISTS agent_coupons (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    coupon_code     TEXT UNIQUE NOT NULL,
    coupon_type     TEXT NOT NULL CHECK (coupon_type IN (
        'PERCENTAGE','FIXED','FREE_SHIPPING','FIRST_ORDER',
        'BULK_DISCOUNT','LOYALTY_BONUS','REFERRAL','SEASONAL',
        'TIER_EXCLUSIVE','API_CREDIT'
    )),
    value           NUMERIC(10,2) NOT NULL DEFAULT 0,    -- % or KRW
    min_order_amount BIGINT DEFAULT 0,
    max_discount     BIGINT DEFAULT 0,                    -- 최대 할인액
    applicable_categories TEXT[] DEFAULT '{}',             -- 빈 배열 = 전체
    applicable_tiers TEXT[] DEFAULT '{}',                  -- 사용 가능 티어
    usage_limit     INT DEFAULT 1,                        -- 총 사용 가능 횟수
    usage_count     INT DEFAULT 0,
    per_agent_limit INT DEFAULT 1,
    valid_from      TIMESTAMPTZ DEFAULT NOW(),
    valid_until     TIMESTAMPTZ,
    is_active       BOOLEAN DEFAULT true,
    description     TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ━━━ 4. Coupon Usage History ━━━
CREATE TABLE IF NOT EXISTS coupon_usage (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    coupon_code     TEXT NOT NULL,
    agent_id        TEXT NOT NULL,
    order_id        TEXT,
    discount_amount BIGINT NOT NULL DEFAULT 0,
    used_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ━━━ 5. Invoices (인보이스) ━━━
CREATE TABLE IF NOT EXISTS invoices (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    invoice_id      TEXT UNIQUE NOT NULL,
    order_id        TEXT NOT NULL,
    agent_id        TEXT NOT NULL,
    seller_id       TEXT,
    items           JSONB NOT NULL DEFAULT '[]',
    subtotal        BIGINT NOT NULL DEFAULT 0,
    discount        BIGINT DEFAULT 0,
    tax             BIGINT DEFAULT 0,
    total           BIGINT NOT NULL DEFAULT 0,
    coupon_code     TEXT,
    loyalty_used    INT DEFAULT 0,
    status          TEXT DEFAULT 'ISSUED' CHECK (status IN ('ISSUED','PAID','CANCELLED','REFUNDED')),
    issued_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ━━━ 6. Usage Tiers (요금제) ━━━
CREATE TABLE IF NOT EXISTS usage_tiers (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tier_name       TEXT UNIQUE NOT NULL,
    calls_per_month INT NOT NULL,
    price_krw       INT NOT NULL DEFAULT 0,
    features        JSONB NOT NULL DEFAULT '{}',
    perks           JSONB NOT NULL DEFAULT '{}',
    sort_order      INT DEFAULT 0
);

-- Seed tiers
INSERT INTO usage_tiers (tier_name, calls_per_month, price_krw, features, perks, sort_order) VALUES
('FREE', 100, 0,
 '{"sandbox":true,"real_orders":false,"webhooks":false,"a2a":false,"priority":false}'::JSONB,
 '{"welcome_bonus":10000,"loyalty_rate":0,"coupon_access":"SEASONAL","support":"community"}'::JSONB, 1),
('STARTER', 5000, 50000,
 '{"sandbox":true,"real_orders":true,"webhooks":"basic","a2a":true,"priority":false}'::JSONB,
 '{"welcome_bonus":50000,"loyalty_rate":1,"coupon_access":"ALL","support":"email","bulk_discount":3}'::JSONB, 2),
('PRO', 50000, 300000,
 '{"sandbox":true,"real_orders":true,"webhooks":"full","a2a":true,"priority":true}'::JSONB,
 '{"welcome_bonus":200000,"loyalty_rate":3,"coupon_access":"ALL","support":"priority","bulk_discount":7,"early_access":true,"negotiation_boost":5}'::JSONB, 3),
('ENTERPRISE', 999999, 0,
 '{"sandbox":true,"real_orders":true,"webhooks":"full","a2a":true,"priority":true,"dedicated_support":true,"sla_guarantee":true}'::JSONB,
 '{"welcome_bonus":500000,"loyalty_rate":5,"coupon_access":"ALL","support":"dedicated","bulk_discount":12,"early_access":true,"negotiation_boost":10,"custom_api":true}'::JSONB, 4)
ON CONFLICT (tier_name) DO NOTHING;

-- ━━━ 7. API Usage Log ━━━
CREATE TABLE IF NOT EXISTS api_usage_log (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id        TEXT NOT NULL,
    endpoint        TEXT NOT NULL,
    response_ms     INT DEFAULT 0,
    status_code     INT DEFAULT 200,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ━━━ 8. Purchase Predictions (예측 구매) ━━━
CREATE TABLE IF NOT EXISTS purchase_predictions (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id        TEXT NOT NULL,
    sku             TEXT NOT NULL,
    product_title   TEXT,
    predicted_date  DATE NOT NULL,
    confidence      NUMERIC(3,2) DEFAULT 0.70,
    avg_interval_days INT,
    last_order_date DATE,
    total_orders    INT DEFAULT 0,
    avg_quantity    INT DEFAULT 1,
    estimated_amount BIGINT DEFAULT 0,
    status          TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING','NOTIFIED','ORDERED','DISMISSED')),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ━━━ 9. Multi-Language Products ━━━
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='title_en') THEN
        ALTER TABLE products ADD COLUMN title_en TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='title_ja') THEN
        ALTER TABLE products ADD COLUMN title_ja TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='title_zh') THEN
        ALTER TABLE products ADD COLUMN title_zh TEXT;
    END IF;
END $$;

-- ━━━ 10. Agents table extension ━━━
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='agents' AND column_name='tier') THEN
        ALTER TABLE agents ADD COLUMN tier TEXT DEFAULT 'FREE';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='agents' AND column_name='monthly_calls') THEN
        ALTER TABLE agents ADD COLUMN monthly_calls INT DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='agents' AND column_name='tier_reset_at') THEN
        ALTER TABLE agents ADD COLUMN tier_reset_at TIMESTAMPTZ DEFAULT (date_trunc('month', NOW()) + interval '1 month');
    END IF;
END $$;

-- ━━━ Indexes ━━━
CREATE INDEX IF NOT EXISTS idx_wallet_agent ON agent_wallets(agent_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_agent ON wallet_transactions(agent_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_type ON wallet_transactions(type);
CREATE INDEX IF NOT EXISTS idx_coupon_code ON agent_coupons(coupon_code);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_agent ON coupon_usage(agent_id);
CREATE INDEX IF NOT EXISTS idx_invoices_agent ON invoices(agent_id);
CREATE INDEX IF NOT EXISTS idx_invoices_order ON invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_agent ON api_usage_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_predictions_agent ON purchase_predictions(agent_id);

-- ━━━ RLS ━━━
ALTER TABLE agent_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read wallets" ON agent_wallets FOR SELECT USING (true);
CREATE POLICY "Auth manage wallets" ON agent_wallets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public read transactions" ON wallet_transactions FOR SELECT USING (true);
CREATE POLICY "Auth insert transactions" ON wallet_transactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public read coupons" ON agent_coupons FOR SELECT USING (true);
CREATE POLICY "Auth manage coupons" ON agent_coupons FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public read coupon_usage" ON coupon_usage FOR SELECT USING (true);
CREATE POLICY "Auth insert coupon_usage" ON coupon_usage FOR INSERT WITH CHECK (true);
CREATE POLICY "Public read invoices" ON invoices FOR SELECT USING (true);
CREATE POLICY "Auth manage invoices" ON invoices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public read tiers" ON usage_tiers FOR SELECT USING (true);
CREATE POLICY "Public read api_usage" ON api_usage_log FOR SELECT USING (true);
CREATE POLICY "Auth insert api_usage" ON api_usage_log FOR INSERT WITH CHECK (true);
CREATE POLICY "Public read predictions" ON purchase_predictions FOR SELECT USING (true);
CREATE POLICY "Auth manage predictions" ON purchase_predictions FOR ALL USING (true) WITH CHECK (true);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- RPC FUNCTIONS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- ━━━ RPC 1: wallet_deposit ━━━
CREATE OR REPLACE FUNCTION wallet_deposit(
    p_api_key TEXT, p_amount BIGINT, p_description TEXT DEFAULT 'Manual deposit'
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_agent RECORD; v_wallet RECORD; v_new_balance BIGINT;
BEGIN
    SELECT agent_id INTO v_agent FROM agents WHERE api_key = p_api_key AND status = 'ACTIVE';
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Invalid agent'); END IF;

    INSERT INTO agent_wallets (agent_id) VALUES (v_agent.agent_id) ON CONFLICT (agent_id) DO NOTHING;

    UPDATE agent_wallets SET balance = balance + p_amount, total_deposited = total_deposited + p_amount, updated_at = NOW()
    WHERE agent_id = v_agent.agent_id RETURNING balance INTO v_new_balance;

    INSERT INTO wallet_transactions (agent_id, type, amount, balance_after, description)
    VALUES (v_agent.agent_id, 'DEPOSIT', p_amount, v_new_balance, p_description);

    RETURN jsonb_build_object('success', true, 'balance', v_new_balance, 'deposited', p_amount);
END; $$;

-- ━━━ RPC 2: wallet_spend ━━━
CREATE OR REPLACE FUNCTION wallet_spend(
    p_api_key TEXT, p_amount BIGINT, p_order_id TEXT DEFAULT NULL, p_description TEXT DEFAULT 'Order payment'
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_agent RECORD; v_balance BIGINT; v_new_balance BIGINT;
BEGIN
    SELECT agent_id INTO v_agent FROM agents WHERE api_key = p_api_key AND status = 'ACTIVE';
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Invalid agent'); END IF;

    SELECT balance INTO v_balance FROM agent_wallets WHERE agent_id = v_agent.agent_id;
    IF v_balance IS NULL OR v_balance < p_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance', 'balance', COALESCE(v_balance, 0));
    END IF;

    UPDATE agent_wallets SET balance = balance - p_amount, total_spent = total_spent + p_amount, updated_at = NOW()
    WHERE agent_id = v_agent.agent_id RETURNING balance INTO v_new_balance;

    INSERT INTO wallet_transactions (agent_id, type, amount, balance_after, order_id, description)
    VALUES (v_agent.agent_id, 'SPEND', p_amount, v_new_balance, p_order_id, p_description);

    -- Earn loyalty points (1 point per 1000 KRW)
    UPDATE agent_wallets SET loyalty_points = loyalty_points + GREATEST(1, (p_amount / 1000)::INT)
    WHERE agent_id = v_agent.agent_id;

    RETURN jsonb_build_object('success', true, 'balance', v_new_balance, 'spent', p_amount, 'loyalty_earned', GREATEST(1, (p_amount / 1000)::INT));
END; $$;

-- ━━━ RPC 3: wallet_refund ━━━
CREATE OR REPLACE FUNCTION wallet_refund(
    p_api_key TEXT, p_order_id TEXT, p_amount BIGINT DEFAULT 0
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_agent RECORD; v_new_balance BIGINT; v_refund BIGINT;
BEGIN
    SELECT agent_id INTO v_agent FROM agents WHERE api_key = p_api_key AND status = 'ACTIVE';
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Invalid agent'); END IF;

    -- If amount is 0, refund the full order spend
    IF p_amount = 0 THEN
        SELECT COALESCE(SUM(amount), 0) INTO v_refund FROM wallet_transactions
        WHERE agent_id = v_agent.agent_id AND order_id = p_order_id AND type = 'SPEND';
    ELSE v_refund := p_amount; END IF;

    IF v_refund = 0 THEN RETURN jsonb_build_object('success', false, 'error', 'No spend found for order'); END IF;

    UPDATE agent_wallets SET balance = balance + v_refund, total_refunded = total_refunded + v_refund, updated_at = NOW()
    WHERE agent_id = v_agent.agent_id RETURNING balance INTO v_new_balance;

    INSERT INTO wallet_transactions (agent_id, type, amount, balance_after, order_id, description)
    VALUES (v_agent.agent_id, 'REFUND', v_refund, v_new_balance, p_order_id, 'Order refund');

    RETURN jsonb_build_object('success', true, 'balance', v_new_balance, 'refunded', v_refund);
END; $$;

-- ━━━ RPC 4: apply_coupon ━━━
CREATE OR REPLACE FUNCTION apply_coupon(
    p_api_key TEXT, p_coupon_code TEXT, p_order_amount BIGINT, p_order_id TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_agent RECORD; v_coupon RECORD; v_discount BIGINT; v_agent_uses INT;
BEGIN
    SELECT agent_id, tier INTO v_agent FROM agents WHERE api_key = p_api_key AND status = 'ACTIVE';
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Invalid agent'); END IF;

    SELECT * INTO v_coupon FROM agent_coupons WHERE coupon_code = p_coupon_code AND is_active = true;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Invalid coupon'); END IF;

    -- Check validity
    IF v_coupon.valid_until IS NOT NULL AND v_coupon.valid_until < NOW() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Coupon expired'); END IF;
    IF v_coupon.usage_count >= v_coupon.usage_limit THEN
        RETURN jsonb_build_object('success', false, 'error', 'Coupon usage limit reached'); END IF;
    IF p_order_amount < v_coupon.min_order_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Minimum order amount not met'); END IF;

    -- Check per-agent limit
    SELECT COUNT(*) INTO v_agent_uses FROM coupon_usage WHERE coupon_code = p_coupon_code AND agent_id = v_agent.agent_id;
    IF v_agent_uses >= v_coupon.per_agent_limit THEN
        RETURN jsonb_build_object('success', false, 'error', 'Per-agent usage limit reached'); END IF;

    -- Check tier restriction
    IF array_length(v_coupon.applicable_tiers, 1) > 0 AND NOT (v_agent.tier = ANY(v_coupon.applicable_tiers)) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Coupon not available for your tier'); END IF;

    -- Calculate discount
    IF v_coupon.coupon_type IN ('PERCENTAGE','BULK_DISCOUNT','LOYALTY_BONUS') THEN
        v_discount := LEAST((p_order_amount * v_coupon.value / 100)::BIGINT, CASE WHEN v_coupon.max_discount > 0 THEN v_coupon.max_discount ELSE p_order_amount END);
    ELSE
        v_discount := LEAST(v_coupon.value::BIGINT, p_order_amount);
    END IF;

    -- Record usage
    INSERT INTO coupon_usage (coupon_code, agent_id, order_id, discount_amount) VALUES (p_coupon_code, v_agent.agent_id, p_order_id, v_discount);
    UPDATE agent_coupons SET usage_count = usage_count + 1 WHERE coupon_code = p_coupon_code;

    RETURN jsonb_build_object('success', true, 'discount', v_discount, 'final_amount', p_order_amount - v_discount, 'coupon_type', v_coupon.coupon_type);
END; $$;

-- ━━━ RPC 5: get_wallet_info ━━━
CREATE OR REPLACE FUNCTION get_wallet_info(p_api_key TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_agent RECORD; v_wallet RECORD; v_transactions JSONB; v_tier RECORD;
BEGIN
    SELECT agent_id, tier, monthly_calls INTO v_agent FROM agents WHERE api_key = p_api_key AND status = 'ACTIVE';
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Invalid agent'); END IF;

    SELECT * INTO v_wallet FROM agent_wallets WHERE agent_id = v_agent.agent_id;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'type', type, 'amount', amount, 'balance_after', balance_after,
        'order_id', order_id, 'description', description, 'created_at', created_at
    ) ORDER BY created_at DESC), '[]'::JSONB) INTO v_transactions
    FROM (SELECT * FROM wallet_transactions WHERE agent_id = v_agent.agent_id ORDER BY created_at DESC LIMIT 50) sub;

    SELECT * INTO v_tier FROM usage_tiers WHERE tier_name = COALESCE(v_agent.tier, 'FREE');

    RETURN jsonb_build_object(
        'success', true,
        'wallet', jsonb_build_object(
            'balance', COALESCE(v_wallet.balance, 0),
            'total_deposited', COALESCE(v_wallet.total_deposited, 0),
            'total_spent', COALESCE(v_wallet.total_spent, 0),
            'total_refunded', COALESCE(v_wallet.total_refunded, 0),
            'loyalty_points', COALESCE(v_wallet.loyalty_points, 0)
        ),
        'tier', jsonb_build_object(
            'name', v_tier.tier_name, 'calls_per_month', v_tier.calls_per_month,
            'monthly_calls_used', v_agent.monthly_calls, 'price', v_tier.price_krw,
            'features', v_tier.features, 'perks', v_tier.perks
        ),
        'transactions', v_transactions
    );
END; $$;

-- ━━━ RPC 6: generate_invoice ━━━
CREATE OR REPLACE FUNCTION generate_invoice(
    p_api_key TEXT, p_order_id TEXT, p_items JSONB, p_coupon_code TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_agent RECORD; v_inv_id TEXT; v_subtotal BIGINT := 0; v_discount BIGINT := 0; v_tax BIGINT; v_total BIGINT;
BEGIN
    SELECT agent_id INTO v_agent FROM agents WHERE api_key = p_api_key AND status = 'ACTIVE';
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Invalid agent'); END IF;

    -- Calculate subtotal
    SELECT COALESCE(SUM((item->>'price')::BIGINT * COALESCE((item->>'qty')::INT, 1)), 0) INTO v_subtotal
    FROM jsonb_array_elements(p_items) AS item;

    v_tax := (v_subtotal * 10 / 110); -- 10% VAT inclusive
    v_total := v_subtotal - v_discount;
    v_inv_id := 'INV-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 6));

    INSERT INTO invoices (invoice_id, order_id, agent_id, items, subtotal, discount, tax, total, coupon_code)
    VALUES (v_inv_id, p_order_id, v_agent.agent_id, p_items, v_subtotal, v_discount, v_tax, v_total, p_coupon_code);

    RETURN jsonb_build_object('success', true, 'invoice_id', v_inv_id, 'subtotal', v_subtotal, 'discount', v_discount, 'tax', v_tax, 'total', v_total);
END; $$;

-- ━━━ RPC 7: generate_predictions ━━━
CREATE OR REPLACE FUNCTION generate_predictions(p_api_key TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_agent RECORD; v_pred RECORD; v_predictions JSONB := '[]'::JSONB;
BEGIN
    SELECT agent_id INTO v_agent FROM agents WHERE api_key = p_api_key AND status = 'ACTIVE';
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Invalid agent'); END IF;

    -- Clear old pending predictions
    DELETE FROM purchase_predictions WHERE agent_id = v_agent.agent_id AND status = 'PENDING';

    -- Analyze order patterns: find items ordered 2+ times, predict next based on avg interval
    FOR v_pred IN
        WITH order_items AS (
            SELECT o.created_at::DATE AS order_date,
                   (item->>'sku') AS sku,
                   (item->>'title') AS title,
                   COALESCE((item->>'qty')::INT, 1) AS qty,
                   COALESCE((item->>'price')::BIGINT, 0) AS price
            FROM orders o, jsonb_array_elements(o.items) AS item
            WHERE o.created_at > NOW() - INTERVAL '6 months'
        ),
        sku_stats AS (
            SELECT sku, MAX(title) AS title,
                   COUNT(*) AS total_orders,
                   AVG(qty) AS avg_qty,
                   AVG(price * qty) AS avg_amount,
                   MAX(order_date) AS last_date,
                   CASE WHEN COUNT(*) > 1 THEN
                       (MAX(order_date) - MIN(order_date))::INT / (COUNT(*) - 1)
                   ELSE 30 END AS avg_interval
            FROM order_items GROUP BY sku HAVING COUNT(*) >= 2
        )
        SELECT sku, title, total_orders, avg_qty::INT AS avg_qty,
               avg_amount::BIGINT AS avg_amount, last_date,
               avg_interval,
               (last_date + (avg_interval || ' days')::INTERVAL)::DATE AS predicted,
               LEAST(0.95, 0.5 + (total_orders * 0.05)) AS confidence
        FROM sku_stats
    LOOP
        INSERT INTO purchase_predictions (agent_id, sku, product_title, predicted_date, confidence, avg_interval_days, last_order_date, total_orders, avg_quantity, estimated_amount)
        VALUES (v_agent.agent_id, v_pred.sku, v_pred.title, v_pred.predicted, v_pred.confidence, v_pred.avg_interval, v_pred.last_date, v_pred.total_orders, v_pred.avg_qty, v_pred.avg_amount);

        v_predictions := v_predictions || jsonb_build_object(
            'sku', v_pred.sku, 'title', v_pred.title, 'predicted_date', v_pred.predicted,
            'confidence', v_pred.confidence, 'avg_interval_days', v_pred.avg_interval,
            'total_orders', v_pred.total_orders, 'estimated_amount', v_pred.avg_amount
        );
    END LOOP;

    RETURN jsonb_build_object('success', true, 'predictions_count', jsonb_array_length(v_predictions), 'predictions', v_predictions);
END; $$;

-- ━━━ RPC 8: get_public_analytics ━━━
CREATE OR REPLACE FUNCTION get_public_analytics()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_agents', (SELECT COUNT(*) FROM agents WHERE status = 'ACTIVE'),
        'total_sellers', (SELECT COUNT(*) FROM sellers WHERE status = 'ACTIVE'),
        'total_products', (SELECT COUNT(*) FROM products),
        'total_orders', (SELECT COUNT(*) FROM orders),
        'total_revenue', (SELECT COALESCE(SUM(total_deposited), 0) FROM agent_wallets),
        'avg_trust_score', (SELECT COALESCE(ROUND(AVG(trust_score)), 0) FROM agents WHERE status = 'ACTIVE'),
        'total_reviews', (SELECT COUNT(*) FROM agent_reviews),
        'total_a2a_queries', (SELECT COUNT(*) FROM a2a_queries),
        'tier_distribution', (
            SELECT COALESCE(jsonb_object_agg(COALESCE(tier, 'FREE'), cnt), '{}'::JSONB)
            FROM (SELECT tier, COUNT(*) AS cnt FROM agents WHERE status = 'ACTIVE' GROUP BY tier) t
        ),
        'category_distribution', (
            SELECT COALESCE(jsonb_object_agg(category, cnt), '{}'::JSONB)
            FROM (SELECT category, COUNT(*) AS cnt FROM products GROUP BY category ORDER BY cnt DESC LIMIT 10) t
        ),
        'recent_orders_7d', (SELECT COUNT(*) FROM orders WHERE created_at > NOW() - INTERVAL '7 days'),
        'generated_at', NOW()
    ) INTO v_result;

    RETURN jsonb_build_object('success', true, 'analytics', v_result);
END; $$;

-- ━━━ Seed Coupons (에이전트 특화 쿠폰) ━━━
INSERT INTO agent_coupons (coupon_code, coupon_type, value, min_order_amount, max_discount, applicable_tiers, usage_limit, per_agent_limit, valid_until, description) VALUES
('WELCOME2026', 'FIRST_ORDER', 10, 0, 10000, '{}', 9999, 1, '2026-12-31'::TIMESTAMPTZ, '🎉 첫 주문 10% 할인 (최대 ₩10,000)'),
('BULK20', 'BULK_DISCOUNT', 20, 500000, 100000, '{}', 9999, 99, '2026-12-31'::TIMESTAMPTZ, '📦 대량구매 20% 할인 (50만원 이상, 최대 ₩100,000)'),
('PROTIER', 'TIER_EXCLUSIVE', 15, 100000, 50000, '{PRO,ENTERPRISE}', 1000, 3, '2026-12-31'::TIMESTAMPTZ, '⭐ Pro/Enterprise 전용 15% 할인'),
('REVIEW500', 'FIXED', 500, 0, 500, '{}', 9999, 99, '2026-12-31'::TIMESTAMPTZ, '📝 리뷰 작성 보상 ₩500 크레딧'),
('A2ABONUS', 'API_CREDIT', 5, 0, 5000, '{}', 9999, 5, '2026-12-31'::TIMESTAMPTZ, '🤖 A2A 네트워크 활동 보상 5%'),
('LOYALTY1000', 'LOYALTY_BONUS', 1000, 0, 1000, '{}', 9999, 99, NULL, '💎 1000 포인트 교환 쿠폰 (₩1,000)'),
('SPRING2026', 'SEASONAL', 12, 30000, 30000, '{}', 500, 1, '2026-04-30'::TIMESTAMPTZ, '🌸 2026 봄 시즌 12% 할인')
ON CONFLICT (coupon_code) DO NOTHING;

-- ━━━ Permissions ━━━
GRANT EXECUTE ON FUNCTION wallet_deposit TO anon, authenticated;
GRANT EXECUTE ON FUNCTION wallet_spend TO anon, authenticated;
GRANT EXECUTE ON FUNCTION wallet_refund TO anon, authenticated;
GRANT EXECUTE ON FUNCTION apply_coupon TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_wallet_info TO anon, authenticated;
GRANT EXECUTE ON FUNCTION generate_invoice TO anon, authenticated;
GRANT EXECUTE ON FUNCTION generate_predictions TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_public_analytics TO anon, authenticated;
