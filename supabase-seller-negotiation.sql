-- ============================================================
-- Seller Negotiation Policy Engine
-- 셀러 협상 에이전트 위임 시스템
-- Run AFTER supabase-sellers.sql & supabase-p1p7-additions.sql
-- ============================================================

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 1. SELLER NEGOTIATION POLICIES
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS seller_negotiation_policies (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id           TEXT NOT NULL REFERENCES sellers(seller_id) ON DELETE CASCADE,

    -- 글로벌 가격 정책
    min_accept_margin   NUMERIC(5,2) DEFAULT 15.0,    -- 최소 수락 마진율 (%)
    auto_accept_above   NUMERIC(5,2) DEFAULT 95.0,    -- 정가 대비 이 비율 이상이면 자동 수락
    auto_reject_below   NUMERIC(5,2) DEFAULT 70.0,    -- 정가 대비 이 비율 이하면 자동 거절
    max_auto_rounds     INTEGER DEFAULT 5,             -- AI 자동 협상 최대 라운드

    -- 양보 전략
    concession_style    TEXT DEFAULT 'MODERATE'
        CHECK (concession_style IN ('CONSERVATIVE','MODERATE','AGGRESSIVE')),
    initial_counter_pct NUMERIC(5,2) DEFAULT 5.0,     -- 첫 카운터 시 정가 대비 할인율 (%)

    -- 대량 할인 티어 [{min_qty, discount_pct}, ...]
    bulk_discount_tiers JSONB DEFAULT '[
        {"min_qty": 10, "discount_pct": 3},
        {"min_qty": 50, "discount_pct": 7},
        {"min_qty": 100, "discount_pct": 12}
    ]'::JSONB,

    -- 카테고리별 오버라이드 {"CONSUMABLES": {"min_margin": 10}, ...}
    category_overrides  JSONB DEFAULT '{}'::JSONB,

    -- 수동 개입 설정
    manual_review_above BIGINT DEFAULT 500000,         -- 이 총액 초과 시 셀러 수동 확인 필요
    notify_on_start     BOOLEAN DEFAULT true,          -- 협상 시작 시 알림
    notify_on_pending   BOOLEAN DEFAULT true,          -- 수동 확인 대기 시 알림

    -- 메타
    is_active           BOOLEAN DEFAULT true,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now(),

    UNIQUE(seller_id)
);

CREATE INDEX IF NOT EXISTS idx_snp_seller ON seller_negotiation_policies(seller_id);

ALTER TABLE seller_negotiation_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read snp" ON seller_negotiation_policies FOR SELECT USING (true);
CREATE POLICY "Authenticated manage snp" ON seller_negotiation_policies FOR ALL USING (true);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 2. ALTER negotiations 테이블: seller_id, 수동개입 상태 추가
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='negotiations' AND column_name='seller_id') THEN
        ALTER TABLE negotiations ADD COLUMN seller_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='negotiations' AND column_name='negotiation_mode') THEN
        ALTER TABLE negotiations ADD COLUMN negotiation_mode TEXT DEFAULT 'SIMULATION'
            CHECK (negotiation_mode IN ('SIMULATION','POLICY','MANUAL'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='negotiations' AND column_name='seller_action') THEN
        ALTER TABLE negotiations ADD COLUMN seller_action TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='negotiations' AND column_name='seller_message') THEN
        ALTER TABLE negotiations ADD COLUMN seller_message TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='negotiations' AND column_name='pending_since') THEN
        ALTER TABLE negotiations ADD COLUMN pending_since TIMESTAMPTZ;
    END IF;
    -- status enum 확장: PENDING_SELLER 추가를 위해 CHECK 제약 없으므로 OK (text field)
END $$;

CREATE INDEX IF NOT EXISTS idx_neg_seller ON negotiations(seller_id);
CREATE INDEX IF NOT EXISTS idx_neg_status_mode ON negotiations(status, negotiation_mode);

-- 기본 셀러 정책 시드 (JSONMart Official)
INSERT INTO seller_negotiation_policies (seller_id, min_accept_margin, auto_accept_above, auto_reject_below, max_auto_rounds, concession_style, manual_review_above)
VALUES ('SLR-JSONMART', 15.0, 95.0, 70.0, 5, 'MODERATE', 500000)
ON CONFLICT (seller_id) DO NOTHING;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 3. RPC: get_seller_negotiation_policy
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION get_seller_negotiation_policy(p_api_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_seller RECORD;
    v_policy RECORD;
BEGIN
    SELECT * INTO v_seller FROM sellers WHERE api_key = p_api_key AND status = 'ACTIVE';
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_API_KEY');
    END IF;

    SELECT * INTO v_policy FROM seller_negotiation_policies WHERE seller_id = v_seller.seller_id;
    IF NOT FOUND THEN
        -- 정책이 없으면 기본값으로 자동 생성
        INSERT INTO seller_negotiation_policies (seller_id)
        VALUES (v_seller.seller_id)
        RETURNING * INTO v_policy;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'seller_id', v_seller.seller_id,
        'policy', jsonb_build_object(
            'id', v_policy.id,
            'min_accept_margin', v_policy.min_accept_margin,
            'auto_accept_above', v_policy.auto_accept_above,
            'auto_reject_below', v_policy.auto_reject_below,
            'max_auto_rounds', v_policy.max_auto_rounds,
            'concession_style', v_policy.concession_style,
            'initial_counter_pct', v_policy.initial_counter_pct,
            'bulk_discount_tiers', v_policy.bulk_discount_tiers,
            'category_overrides', v_policy.category_overrides,
            'manual_review_above', v_policy.manual_review_above,
            'notify_on_start', v_policy.notify_on_start,
            'notify_on_pending', v_policy.notify_on_pending,
            'is_active', v_policy.is_active,
            'updated_at', v_policy.updated_at
        )
    );
END;
$$;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 4. RPC: update_seller_negotiation_policy
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION update_seller_negotiation_policy(
    p_api_key           TEXT,
    p_min_accept_margin NUMERIC DEFAULT NULL,
    p_auto_accept_above NUMERIC DEFAULT NULL,
    p_auto_reject_below NUMERIC DEFAULT NULL,
    p_max_auto_rounds   INTEGER DEFAULT NULL,
    p_concession_style  TEXT    DEFAULT NULL,
    p_initial_counter_pct NUMERIC DEFAULT NULL,
    p_bulk_discount_tiers JSONB  DEFAULT NULL,
    p_category_overrides  JSONB  DEFAULT NULL,
    p_manual_review_above BIGINT DEFAULT NULL,
    p_notify_on_start   BOOLEAN DEFAULT NULL,
    p_notify_on_pending BOOLEAN DEFAULT NULL,
    p_is_active         BOOLEAN DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_seller RECORD;
BEGIN
    SELECT * INTO v_seller FROM sellers WHERE api_key = p_api_key AND status = 'ACTIVE';
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_API_KEY');
    END IF;

    -- Upsert
    INSERT INTO seller_negotiation_policies (seller_id)
    VALUES (v_seller.seller_id)
    ON CONFLICT (seller_id) DO NOTHING;

    UPDATE seller_negotiation_policies SET
        min_accept_margin   = COALESCE(p_min_accept_margin, min_accept_margin),
        auto_accept_above   = COALESCE(p_auto_accept_above, auto_accept_above),
        auto_reject_below   = COALESCE(p_auto_reject_below, auto_reject_below),
        max_auto_rounds     = COALESCE(p_max_auto_rounds, max_auto_rounds),
        concession_style    = COALESCE(p_concession_style, concession_style),
        initial_counter_pct = COALESCE(p_initial_counter_pct, initial_counter_pct),
        bulk_discount_tiers = COALESCE(p_bulk_discount_tiers, bulk_discount_tiers),
        category_overrides  = COALESCE(p_category_overrides, category_overrides),
        manual_review_above = COALESCE(p_manual_review_above, manual_review_above),
        notify_on_start     = COALESCE(p_notify_on_start, notify_on_start),
        notify_on_pending   = COALESCE(p_notify_on_pending, notify_on_pending),
        is_active           = COALESCE(p_is_active, is_active),
        updated_at          = now()
    WHERE seller_id = v_seller.seller_id;

    RETURN jsonb_build_object('success', true, 'message', 'Policy updated');
END;
$$;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 5. RPC: policy_based_negotiate (핵심 — 셀러 정책 기반 자동 대응)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION policy_based_negotiate(
    p_api_key      TEXT,     -- 구매 에이전트 API 키
    p_sku          TEXT,
    p_qty          INTEGER,
    p_unit_price   INTEGER   -- 구매 에이전트 제안 단가
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_agent   RECORD;
    v_product RECORD;
    v_seller  RECORD;
    v_policy  RECORD;
    v_neg_id  TEXT;
    v_list_price   INTEGER;
    v_offer_ratio  NUMERIC;
    v_total_amount BIGINT;
    v_status       TEXT;
    v_counter_price INTEGER;
    v_message      TEXT;
    v_cat_override JSONB;
    v_effective_min_margin NUMERIC;
    v_effective_auto_accept NUMERIC;
    v_effective_auto_reject NUMERIC;
    v_bulk_discount NUMERIC := 0;
    v_tier JSONB;
BEGIN
    -- 1. 구매 에이전트 인증
    SELECT * INTO v_agent FROM agents WHERE api_key = p_api_key;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_API_KEY');
    END IF;

    -- 2. 상품 조회
    SELECT sku, title, category, price, seller_id
    INTO v_product
    FROM products WHERE sku = p_sku;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'PRODUCT_NOT_FOUND');
    END IF;

    v_list_price := v_product.price;
    v_offer_ratio := (p_unit_price::NUMERIC / v_list_price::NUMERIC) * 100;
    v_total_amount := p_unit_price::BIGINT * p_qty::BIGINT;

    -- 3. 셀러 정책 조회
    SELECT snp.* INTO v_policy
    FROM seller_negotiation_policies snp
    WHERE snp.seller_id = v_product.seller_id AND snp.is_active = true;

    -- 정책 없으면 기본값으로 생성
    IF NOT FOUND THEN
        INSERT INTO seller_negotiation_policies (seller_id)
        VALUES (COALESCE(v_product.seller_id, 'SLR-JSONMART'))
        ON CONFLICT (seller_id) DO NOTHING;

        SELECT * INTO v_policy
        FROM seller_negotiation_policies
        WHERE seller_id = COALESCE(v_product.seller_id, 'SLR-JSONMART');
    END IF;

    -- 4. 카테고리 오버라이드 확인
    v_cat_override := v_policy.category_overrides -> v_product.category;
    v_effective_min_margin := COALESCE((v_cat_override ->> 'min_margin')::NUMERIC, v_policy.min_accept_margin);
    v_effective_auto_accept := COALESCE((v_cat_override ->> 'auto_accept')::NUMERIC, v_policy.auto_accept_above);
    v_effective_auto_reject := COALESCE((v_cat_override ->> 'auto_reject')::NUMERIC, v_policy.auto_reject_below);

    -- 5. 대량 할인 적용 확인
    IF v_policy.bulk_discount_tiers IS NOT NULL AND jsonb_array_length(v_policy.bulk_discount_tiers) > 0 THEN
        FOR v_tier IN SELECT * FROM jsonb_array_elements(v_policy.bulk_discount_tiers)
        LOOP
            IF p_qty >= (v_tier ->> 'min_qty')::INTEGER THEN
                v_bulk_discount := GREATEST(v_bulk_discount, (v_tier ->> 'discount_pct')::NUMERIC);
            END IF;
        END LOOP;
    END IF;

    -- 대량할인 적용 시 effective accept 범위 조정
    v_effective_auto_accept := v_effective_auto_accept - v_bulk_discount;

    -- 6. Negotiation ID 생성
    v_neg_id := 'NEG-' || UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 8));

    -- 7. 정책 기반 판정
    IF v_offer_ratio >= v_effective_auto_accept THEN
        -- 자동 수락
        v_status := 'AGREED';
        v_counter_price := p_unit_price;
        v_message := 'Offer accepted. Price within policy threshold.';

        IF v_bulk_discount > 0 THEN
            v_message := v_message || ' Bulk discount of ' || v_bulk_discount || '% applied.';
        END IF;

    ELSIF v_offer_ratio < v_effective_auto_reject THEN
        -- 자동 거절
        v_status := 'REJECTED';
        v_counter_price := ROUND(v_list_price * (1 - v_policy.initial_counter_pct / 100));
        v_message := 'Offer too low. Minimum acceptable: ' || v_effective_auto_reject || '% of list price.';

    ELSIF v_total_amount > v_policy.manual_review_above THEN
        -- 수동 검토 필요
        v_status := 'PENDING_SELLER';
        v_counter_price := p_unit_price;
        v_message := 'Total amount exceeds auto-approval limit. Awaiting seller review.';

    ELSE
        -- 자동 카운터 제안
        v_status := 'COUNTER';
        -- 양보 전략에 따른 카운터 가격 계산
        CASE v_policy.concession_style
            WHEN 'CONSERVATIVE' THEN
                v_counter_price := ROUND(v_list_price * (1 - v_policy.initial_counter_pct / 200));
            WHEN 'AGGRESSIVE' THEN
                v_counter_price := ROUND(v_list_price * (1 - v_policy.initial_counter_pct / 80));
            ELSE -- MODERATE
                v_counter_price := ROUND(v_list_price * (1 - v_policy.initial_counter_pct / 100));
        END CASE;

        -- 대량 할인 적용
        IF v_bulk_discount > 0 THEN
            v_counter_price := ROUND(v_counter_price * (1 - v_bulk_discount / 100));
        END IF;

        -- 최소 마진 보장
        IF v_counter_price < ROUND(v_list_price * (1 - v_effective_min_margin / 100)) THEN
            v_counter_price := ROUND(v_list_price * (1 - v_effective_min_margin / 100));
        END IF;

        v_message := 'Counter-offer: ₩' || v_counter_price || '/unit.';
        IF v_bulk_discount > 0 THEN
            v_message := v_message || ' Includes ' || v_bulk_discount || '% bulk discount.';
        END IF;
    END IF;

    -- 8. 협상 레코드 저장
    INSERT INTO negotiations (
        negotiation_id, agent_id, sku, product_title, list_price,
        final_price, policy_budget, buyer_agent_id, seller_agent_id,
        status, rounds, max_rounds, seller_id, negotiation_mode,
        pending_since, created_at
    ) VALUES (
        v_neg_id,
        v_agent.agent_id,
        p_sku,
        v_product.title,
        v_list_price,
        CASE WHEN v_status = 'AGREED' THEN p_unit_price ELSE NULL END,
        NULL,
        v_agent.agent_id,
        COALESCE(v_product.seller_id, 'SLR-JSONMART'),
        v_status,
        jsonb_build_array(jsonb_build_object(
            'round', 1,
            'proposedBy', 'buyer',
            'price', p_unit_price,
            'message', 'Buyer offers ₩' || p_unit_price || '/unit × ' || p_qty,
            'timestamp', now()
        ), jsonb_build_object(
            'round', 1,
            'proposedBy', 'seller',
            'price', v_counter_price,
            'message', v_message,
            'timestamp', now()
        )),
        v_policy.max_auto_rounds,
        COALESCE(v_product.seller_id, 'SLR-JSONMART'),
        'POLICY',
        CASE WHEN v_status = 'PENDING_SELLER' THEN now() ELSE NULL END,
        now()
    );

    -- 9. 결과 반환
    RETURN jsonb_build_object(
        'success', true,
        'negotiation_id', v_neg_id,
        'status', v_status,
        'list_price', v_list_price,
        'offered_price', p_unit_price,
        'counter_price', v_counter_price,
        'bulk_discount_applied', v_bulk_discount,
        'message', v_message,
        'next_action', CASE
            WHEN v_status = 'AGREED' THEN 'Create order with this negotiation_id.'
            WHEN v_status = 'REJECTED' THEN 'Increase offer or try different product.'
            WHEN v_status = 'PENDING_SELLER' THEN 'Wait for seller review. Check status later.'
            WHEN v_status = 'COUNTER' THEN 'Accept counter or submit new offer.'
        END
    );
END;
$$;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 6. RPC: seller_respond_negotiation (셀러 수동 개입)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION seller_respond_negotiation(
    p_api_key        TEXT,    -- 셀러 API 키
    p_negotiation_id TEXT,
    p_action         TEXT,    -- 'ACCEPT', 'REJECT', 'COUNTER'
    p_counter_price  INTEGER DEFAULT NULL,
    p_message        TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_seller RECORD;
    v_neg    RECORD;
    v_new_status TEXT;
    v_final_price INTEGER;
BEGIN
    -- 셀러 인증
    SELECT * INTO v_seller FROM sellers WHERE api_key = p_api_key AND status = 'ACTIVE';
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_API_KEY');
    END IF;

    -- 협상 조회
    SELECT * INTO v_neg FROM negotiations
    WHERE negotiation_id = p_negotiation_id
      AND seller_id = v_seller.seller_id
      AND status IN ('PENDING_SELLER', 'COUNTER', 'PENDING');
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'NEGOTIATION_NOT_FOUND_OR_CLOSED');
    END IF;

    -- Action 처리
    CASE p_action
        WHEN 'ACCEPT' THEN
            v_new_status := 'AGREED';
            -- 최신 buyer 제안가 찾기
            v_final_price := COALESCE(
                (SELECT (r ->> 'price')::INTEGER
                 FROM jsonb_array_elements(v_neg.rounds) r
                 WHERE r ->> 'proposedBy' = 'buyer'
                 ORDER BY (r ->> 'round')::INTEGER DESC LIMIT 1),
                v_neg.list_price
            );
        WHEN 'REJECT' THEN
            v_new_status := 'REJECTED';
            v_final_price := NULL;
        WHEN 'COUNTER' THEN
            IF p_counter_price IS NULL THEN
                RETURN jsonb_build_object('success', false, 'error', 'COUNTER_PRICE_REQUIRED');
            END IF;
            v_new_status := 'COUNTER';
            v_final_price := NULL;
        ELSE
            RETURN jsonb_build_object('success', false, 'error', 'INVALID_ACTION: use ACCEPT, REJECT, or COUNTER');
    END CASE;

    -- rounds에 셀러 응답 추가
    UPDATE negotiations SET
        status = v_new_status,
        final_price = v_final_price,
        seller_action = p_action,
        seller_message = COALESCE(p_message, ''),
        completed_at = CASE WHEN v_new_status IN ('AGREED','REJECTED') THEN now() ELSE NULL END,
        pending_since = NULL,
        rounds = v_neg.rounds || jsonb_build_object(
            'round', jsonb_array_length(v_neg.rounds) / 2 + 1,
            'proposedBy', 'seller',
            'price', COALESCE(p_counter_price, v_final_price, v_neg.list_price),
            'message', COALESCE(p_message, 'Seller ' || lower(p_action) || 'ed'),
            'timestamp', now(),
            'manual', true
        ),
        savings_pct = CASE
            WHEN v_new_status = 'AGREED' AND v_final_price IS NOT NULL AND v_neg.list_price > 0
            THEN ROUND((1 - v_final_price::NUMERIC / v_neg.list_price::NUMERIC) * 100, 2)
            ELSE NULL
        END
    WHERE negotiation_id = p_negotiation_id;

    RETURN jsonb_build_object(
        'success', true,
        'negotiation_id', p_negotiation_id,
        'action', p_action,
        'new_status', v_new_status,
        'final_price', v_final_price,
        'counter_price', p_counter_price,
        'message', COALESCE(p_message, 'Seller responded: ' || p_action)
    );
END;
$$;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 7. RPC: get_seller_negotiations (셀러용 협상 목록)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION get_seller_negotiations(
    p_api_key TEXT,
    p_status  TEXT DEFAULT NULL,
    p_limit   INTEGER DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_seller RECORD;
    v_result JSONB;
    v_pending_count INTEGER;
BEGIN
    SELECT * INTO v_seller FROM sellers WHERE api_key = p_api_key AND status = 'ACTIVE';
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_API_KEY');
    END IF;

    -- 대기 중 수 카운트
    SELECT COUNT(*) INTO v_pending_count
    FROM negotiations
    WHERE seller_id = v_seller.seller_id AND status = 'PENDING_SELLER';

    -- 협상 목록
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'negotiation_id', n.negotiation_id,
        'sku', n.sku,
        'product_title', n.product_title,
        'list_price', n.list_price,
        'final_price', n.final_price,
        'buyer_agent_id', n.buyer_agent_id,
        'status', n.status,
        'negotiation_mode', n.negotiation_mode,
        'rounds', n.rounds,
        'max_rounds', n.max_rounds,
        'savings_pct', n.savings_pct,
        'seller_action', n.seller_action,
        'seller_message', n.seller_message,
        'pending_since', n.pending_since,
        'created_at', n.created_at,
        'completed_at', n.completed_at
    ) ORDER BY n.created_at DESC), '[]'::JSONB)
    INTO v_result
    FROM (
        SELECT * FROM negotiations
        WHERE seller_id = v_seller.seller_id
          AND (p_status IS NULL OR status = p_status)
        ORDER BY created_at DESC
        LIMIT p_limit
    ) n;

    RETURN jsonb_build_object(
        'success', true,
        'seller_id', v_seller.seller_id,
        'pending_count', v_pending_count,
        'negotiations', v_result
    );
END;
$$;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 8. PERMISSIONS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

GRANT EXECUTE ON FUNCTION get_seller_negotiation_policy(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION update_seller_negotiation_policy(TEXT, NUMERIC, NUMERIC, NUMERIC, INTEGER, TEXT, NUMERIC, JSONB, JSONB, BIGINT, BOOLEAN, BOOLEAN, BOOLEAN) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION policy_based_negotiate(TEXT, TEXT, INTEGER, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION seller_respond_negotiation(TEXT, TEXT, TEXT, INTEGER, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_seller_negotiations(TEXT, TEXT, INTEGER) TO anon, authenticated;
