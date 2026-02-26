-- ============================================
-- JSONMART Telegram Notification Triggers
-- 🔔 모든 중요 활동을 텔레그램으로 알림
-- ============================================
-- Run this in Supabase SQL Editor
-- 사전 조건: notify_admin_telegram(TEXT) 함수가 존재해야 함
--           notification_config 테이블에 telegram_bot_token, telegram_chat_id 설정 필요
-- ============================================

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 0. 내부 전용 notify 함수 (auth.uid() 체크 없는 버전)
--    트리거에서 호출할 때 auth.uid()가 NULL이므로
--    기존 notify_admin_telegram은 silent block됨
--    이 함수는 트리거 전용으로 인증 체크를 건너뜀
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION _internal_telegram_notify(p_message TEXT)
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

-- 외부 접근 차단
REVOKE EXECUTE ON FUNCTION _internal_telegram_notify(TEXT) FROM anon, authenticated;


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 1. 🤖 에이전트 등록 알림
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION tg_notify_agent_registered()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NEW.status = 'PENDING_APPROVAL' THEN
        PERFORM _internal_telegram_notify(
            '🤖 <b>새 에이전트 등록</b>' || chr(10) ||
            '이름: ' || COALESCE(NEW.name, 'N/A') || chr(10) ||
            'ID: ' || NEW.agent_id || chr(10) ||
            '시간: ' || TO_CHAR(NOW() AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI') || chr(10) ||
            '👉 관리자 승인이 필요합니다.'
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_agent_registered ON agents;
CREATE TRIGGER trg_agent_registered
    AFTER INSERT ON agents
    FOR EACH ROW
    EXECUTE FUNCTION tg_notify_agent_registered();


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 2. ✅ 에이전트 상태 변경 알림 (승인/정지/거절)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION tg_notify_agent_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_emoji TEXT;
    v_label TEXT;
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        CASE NEW.status
            WHEN 'ACTIVE' THEN v_emoji := '✅'; v_label := '승인됨';
            WHEN 'SUSPENDED' THEN v_emoji := '⛔'; v_label := '정지됨';
            WHEN 'REJECTED' THEN v_emoji := '❌'; v_label := '거절됨';
            ELSE v_emoji := '🔄'; v_label := NEW.status;
        END CASE;

        PERFORM _internal_telegram_notify(
            v_emoji || ' <b>에이전트 상태 변경</b>' || chr(10) ||
            '이름: ' || COALESCE(NEW.name, 'N/A') || chr(10) ||
            'ID: ' || NEW.agent_id || chr(10) ||
            '변경: ' || COALESCE(OLD.status, 'N/A') || ' → ' || NEW.status
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_agent_status_change ON agents;
CREATE TRIGGER trg_agent_status_change
    AFTER UPDATE ON agents
    FOR EACH ROW
    EXECUTE FUNCTION tg_notify_agent_status_change();


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 3. 🛒 새 주문 알림
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION tg_notify_new_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    PERFORM _internal_telegram_notify(
        '🛒 <b>새 주문</b>' || chr(10) ||
        '주문ID: ' || COALESCE(NEW.order_id, 'N/A') || chr(10) ||
        '상품: ' || COALESCE(NEW.product_title, COALESCE(NEW.sku, 'N/A')) || chr(10) ||
        '수량: ' || COALESCE(NEW.quantity::TEXT, '1') || chr(10) ||
        '금액: ₩' || COALESCE(NEW.total_price::TEXT, NEW.authorized_amount::TEXT) || chr(10) ||
        '결제: ' || COALESCE(NEW.payment_method, 'payapp') || chr(10) ||
        '에이전트: ' || COALESCE(NEW.agent_id, 'N/A')
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_new_order ON orders;
CREATE TRIGGER trg_new_order
    AFTER INSERT ON orders
    FOR EACH ROW
    EXECUTE FUNCTION tg_notify_new_order();


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 4. 💳 결제 완료 / 📦 배송 / ❌ 취소 알림
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION tg_notify_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_emoji TEXT;
    v_label TEXT;
BEGIN
    -- Only trigger when status actually changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        CASE NEW.status
            WHEN 'CONFIRMED' THEN v_emoji := '💳'; v_label := '결제 확정';
            WHEN 'SHIPPED' THEN v_emoji := '📦'; v_label := '배송 출발';
            WHEN 'DELIVERED' THEN v_emoji := '✅'; v_label := '배송 완료';
            WHEN 'VOIDED' THEN v_emoji := '❌'; v_label := '주문 취소';
            WHEN 'CANCELLED' THEN v_emoji := '🚫'; v_label := '주문 취소';
            ELSE RETURN NEW;  -- Skip minor status changes
        END CASE;

        PERFORM _internal_telegram_notify(
            v_emoji || ' <b>' || v_label || '</b>' || chr(10) ||
            '주문ID: ' || COALESCE(NEW.order_id, 'N/A') || chr(10) ||
            '상품: ' || COALESCE(NEW.product_title, COALESCE(NEW.sku, 'N/A')) || chr(10) ||
            '금액: ₩' || COALESCE(NEW.total_price::TEXT, NEW.authorized_amount::TEXT) ||
            CASE WHEN NEW.status = 'SHIPPED' AND NEW.tracking_number IS NOT NULL
                THEN chr(10) || '운송장: ' || NEW.tracking_number
                ELSE '' END
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_status_change ON orders;
CREATE TRIGGER trg_order_status_change
    AFTER UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION tg_notify_order_status_change();


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 5. ⭐ 리뷰 등록 알림 (BLOCKLIST는 긴급 표시)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION tg_notify_new_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_emoji TEXT;
    v_urgent TEXT := '';
BEGIN
    CASE NEW.verdict
        WHEN 'ENDORSE' THEN v_emoji := '⭐';
        WHEN 'WARN' THEN v_emoji := '⚠️';
        WHEN 'BLOCKLIST' THEN v_emoji := '🔴'; v_urgent := '⚡ 긴급! ';
        ELSE v_emoji := '📝';
    END CASE;

    PERFORM _internal_telegram_notify(
        v_emoji || ' <b>' || v_urgent || '리뷰 등록</b>' || chr(10) ||
        'SKU: ' || NEW.target_sku || chr(10) ||
        '평결: ' || NEW.verdict || chr(10) ||
        '리뷰어: ' || NEW.reviewer_agent_id || chr(10) ||
        '스펙 부합: ' || COALESCE(ROUND(NEW.spec_compliance * 100)::TEXT || '%', 'N/A') || chr(10) ||
        '배송 지연: ' || COALESCE(NEW.fulfillment_delta::TEXT || 'h', '0h')
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_new_review ON agent_reviews;
CREATE TRIGGER trg_new_review
    AFTER INSERT ON agent_reviews
    FOR EACH ROW
    EXECUTE FUNCTION tg_notify_new_review();


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 6. 💰 월렛 대규모 거래 알림 (충전/사용/환불)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION tg_notify_wallet_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_emoji TEXT;
    v_label TEXT;
BEGIN
    CASE NEW.type
        WHEN 'DEPOSIT' THEN v_emoji := '💰'; v_label := '월렛 충전';
        WHEN 'SPEND' THEN v_emoji := '💸'; v_label := '월렛 사용';
        WHEN 'REFUND' THEN v_emoji := '↩️'; v_label := '환불';
        WHEN 'BONUS' THEN v_emoji := '🎁'; v_label := '보너스';
        ELSE RETURN NEW;  -- Skip minor types (loyalty, etc)
    END CASE;

    PERFORM _internal_telegram_notify(
        v_emoji || ' <b>' || v_label || '</b>' || chr(10) ||
        '에이전트: ' || NEW.agent_id || chr(10) ||
        '금액: ₩' || NEW.amount::TEXT || chr(10) ||
        '잔액: ₩' || NEW.balance_after::TEXT ||
        CASE WHEN NEW.order_id IS NOT NULL
            THEN chr(10) || '주문: ' || NEW.order_id
            ELSE '' END
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wallet_transaction ON wallet_transactions;
CREATE TRIGGER trg_wallet_transaction
    AFTER INSERT ON wallet_transactions
    FOR EACH ROW
    EXECUTE FUNCTION tg_notify_wallet_transaction();


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 7. 📝 셀러 등록 알림
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION tg_notify_seller_registered()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    PERFORM _internal_telegram_notify(
        '📝 <b>새 셀러 등록</b>' || chr(10) ||
        '셀러: ' || COALESCE(NEW.company_name, NEW.seller_name, 'N/A') || chr(10) ||
        'ID: ' || COALESCE(NEW.seller_id, NEW.id::TEXT) || chr(10) ||
        '시간: ' || TO_CHAR(NOW() AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI')
    );
    RETURN NEW;
END;
$$;

-- sellers 테이블이 존재하면 트리거 생성
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sellers') THEN
        EXECUTE 'DROP TRIGGER IF EXISTS trg_seller_registered ON sellers';
        EXECUTE 'CREATE TRIGGER trg_seller_registered
            AFTER INSERT ON sellers
            FOR EACH ROW
            EXECUTE FUNCTION tg_notify_seller_registered()';
    END IF;
END $$;


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 8. 🆕 새 상품 등록 알림
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION tg_notify_new_product()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    PERFORM _internal_telegram_notify(
        '🆕 <b>새 상품 등록</b>' || chr(10) ||
        'SKU: ' || COALESCE(NEW.sku, 'N/A') || chr(10) ||
        '상품명: ' || COALESCE(NEW.title, 'N/A') || chr(10) ||
        '카테고리: ' || COALESCE(NEW.category, 'N/A') || chr(10) ||
        '가격: ₩' || COALESCE(NEW.price::TEXT, '0') || chr(10) ||
        '소싱: ' || COALESCE(NEW.sourcing_type, 'HUMAN')
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_new_product ON products;
CREATE TRIGGER trg_new_product
    AFTER INSERT ON products
    FOR EACH ROW
    EXECUTE FUNCTION tg_notify_new_product();


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 9. 💬 A2A 쿼리 알림
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION tg_notify_a2a_query()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    PERFORM _internal_telegram_notify(
        '💬 <b>A2A 쿼리</b>' || chr(10) ||
        '발신: ' || COALESCE(NEW.from_agent_id, 'N/A') || chr(10) ||
        '수신: ' || COALESCE(NEW.to_agent_id, 'N/A') || chr(10) ||
        '유형: ' || COALESCE(NEW.query_type, 'N/A')
    );
    RETURN NEW;
END;
$$;

-- a2a_queries 테이블이 존재하면 트리거 생성
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'a2a_queries') THEN
        EXECUTE 'DROP TRIGGER IF EXISTS trg_a2a_query ON a2a_queries';
        EXECUTE 'CREATE TRIGGER trg_a2a_query
            AFTER INSERT ON a2a_queries
            FOR EACH ROW
            EXECUTE FUNCTION tg_notify_a2a_query()';
    END IF;
END $$;


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 10. 📊 일일 요약 함수 (수동 호출 또는 cron)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION send_daily_summary()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_orders_today INT;
    v_revenue_today BIGINT;
    v_new_agents INT;
    v_new_reviews INT;
    v_new_products INT;
    v_msg TEXT;
BEGIN
    -- 오늘 통계 (KST 기준)
    SELECT COUNT(*) INTO v_orders_today
    FROM orders WHERE created_at >= (NOW() AT TIME ZONE 'Asia/Seoul')::DATE;

    SELECT COALESCE(SUM(total_price), 0) INTO v_revenue_today
    FROM orders WHERE created_at >= (NOW() AT TIME ZONE 'Asia/Seoul')::DATE
    AND status NOT IN ('VOIDED', 'CANCELLED');

    SELECT COUNT(*) INTO v_new_agents
    FROM agents WHERE created_at >= (NOW() AT TIME ZONE 'Asia/Seoul')::DATE;

    SELECT COUNT(*) INTO v_new_reviews
    FROM agent_reviews WHERE created_at >= (NOW() AT TIME ZONE 'Asia/Seoul')::DATE;

    SELECT COUNT(*) INTO v_new_products
    FROM products WHERE created_at >= (NOW() AT TIME ZONE 'Asia/Seoul')::DATE;

    v_msg := '📊 <b>JSONMart 일일 요약</b>' || chr(10) ||
        '📅 ' || TO_CHAR(NOW() AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') || chr(10) ||
        '━━━━━━━━━━━━━━━' || chr(10) ||
        '🛒 오늘 주문: ' || v_orders_today || '건' || chr(10) ||
        '💰 매출: ₩' || TO_CHAR(v_revenue_today, 'FM999,999,999') || chr(10) ||
        '🤖 신규 에이전트: ' || v_new_agents || chr(10) ||
        '⭐ 신규 리뷰: ' || v_new_reviews || chr(10) ||
        '🆕 신규 상품: ' || v_new_products || chr(10) ||
        '━━━━━━━━━━━━━━━' || chr(10) ||
        '📈 전체 상품: ' || (SELECT COUNT(*) FROM products) || chr(10) ||
        '🤖 활성 에이전트: ' || (SELECT COUNT(*) FROM agents WHERE status = 'ACTIVE') || chr(10) ||
        '📦 총 주문: ' || (SELECT COUNT(*) FROM orders);

    PERFORM _internal_telegram_notify(v_msg);

    RETURN jsonb_build_object('success', true, 'message', 'Daily summary sent');
END;
$$;

GRANT EXECUTE ON FUNCTION send_daily_summary() TO authenticated;

-- pg_cron으로 매일 오후 11시(KST) 자동 전송:
-- SELECT cron.schedule('daily-summary', '0 14 * * *',
--   $$SELECT send_daily_summary()$$);
-- (UTC 14:00 = KST 23:00)

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 수동 테스트:
-- SELECT send_daily_summary();
-- SELECT _internal_telegram_notify('🔔 JSONMart 텔레그램 알림 테스트');
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
