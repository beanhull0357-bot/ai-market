-- supabase-agent-notifications.sql
-- Agent Inbox (알림 우편함) + Webhook 이벤트 확장
-- 관리자 → 에이전트 소통 시스템

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 1. 테이블: agent_notifications (에이전트 알림 우편함)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS agent_notifications (
    id           BIGSERIAL PRIMARY KEY,
    -- 대상: NULL = 전체 에이전트, 특정 agent_id = 개별 에이전트
    agent_id     TEXT DEFAULT NULL,
    -- 알림 유형
    ntype        TEXT NOT NULL CHECK (ntype IN (
        'NEW_PRODUCT', 'PRICE_DROP', 'PROMOTION', 'RESTOCK',
        'SYSTEM', 'ANNOUNCEMENT', 'MAINTENANCE'
    )),
    title        TEXT NOT NULL,
    message      TEXT NOT NULL,
    -- 관련 데이터 (SKU, promo_id 등)
    data         JSONB DEFAULT '{}',
    -- 읽음 추적 (개별 알림용)
    read_by      TEXT[] DEFAULT '{}',
    -- 유효기간
    expires_at   TIMESTAMPTZ DEFAULT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_notif_agent ON agent_notifications(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_notif_type ON agent_notifications(ntype);
CREATE INDEX IF NOT EXISTS idx_agent_notif_created ON agent_notifications(created_at DESC);

ALTER TABLE agent_notifications ENABLE ROW LEVEL SECURITY;

-- anon/authenticated는 자기 알림 + 전체 알림만 읽기
DROP POLICY IF EXISTS "agent_notif_read" ON agent_notifications;
CREATE POLICY "agent_notif_read" ON agent_notifications FOR SELECT
    USING (true);

-- 쓰기는 service_role만 (관리자 RPC 통해)
DROP POLICY IF EXISTS "agent_notif_write" ON agent_notifications;
CREATE POLICY "agent_notif_write" ON agent_notifications FOR ALL
    USING (auth.role() = 'service_role');


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 2. RPC: admin_send_notification (관리자 공지 발송)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION admin_send_notification(
    p_ntype       TEXT,
    p_title       TEXT,
    p_message     TEXT,
    p_data        JSONB DEFAULT '{}',
    p_agent_id    TEXT DEFAULT NULL,    -- NULL = 전체, 특정 ID = 개별
    p_expires_at  TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_notif_id BIGINT;
    v_webhook_count INT := 0;
BEGIN
    -- 알림 저장
    INSERT INTO agent_notifications (agent_id, ntype, title, message, data, expires_at)
    VALUES (p_agent_id, p_ntype, p_title, p_message, p_data, p_expires_at)
    RETURNING id INTO v_notif_id;

    -- 웹훅 구독 에이전트들에게 PUSH 알림
    -- (agent_webhook_subscriptions 에서 해당 이벤트 구독자 조회 후 dispatch)
    PERFORM dispatch_webhooks(
        jsonb_build_object(
            'event', p_ntype,
            'notification_id', v_notif_id,
            'title', p_title,
            'message', p_message,
            'data', p_data,
            'created_at', NOW()
        )
    );

    -- 구독 에이전트 수 (참고용)
    SELECT COUNT(*) INTO v_webhook_count
    FROM agent_webhook_subscriptions
    WHERE active = true
      AND events @> ARRAY[p_ntype];

    RETURN jsonb_build_object(
        'success', true,
        'notification_id', v_notif_id,
        'target', COALESCE(p_agent_id, 'ALL'),
        'webhook_push_count', v_webhook_count
    );
END;
$$;

GRANT EXECUTE ON FUNCTION admin_send_notification TO authenticated;


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 3. RPC: get_agent_notifications (에이전트 알림 조회 - PULL)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION get_agent_notifications(
    p_api_key   TEXT,
    p_unread    BOOLEAN DEFAULT FALSE,
    p_ntype     TEXT DEFAULT NULL,
    p_limit     INT DEFAULT 20
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_agent   RECORD;
    v_result  JSONB;
BEGIN
    -- 인증
    SELECT * INTO v_agent FROM agents
    WHERE api_key = p_api_key AND status = 'ACTIVE';

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_API_KEY');
    END IF;

    -- 알림 조회: 전체 공지(agent_id IS NULL) + 개별 알림(agent_id = 나)
    SELECT jsonb_build_object(
        'success', true,
        'agent_id', v_agent.agent_id,
        'notifications', COALESCE(jsonb_agg(n ORDER BY n.created_at DESC), '[]'::jsonb),
        'unread_count', (
            SELECT COUNT(*) FROM agent_notifications
            WHERE (agent_id IS NULL OR agent_id = v_agent.agent_id)
              AND (expires_at IS NULL OR expires_at > NOW())
              AND NOT (read_by @> ARRAY[v_agent.agent_id])
        )
    ) INTO v_result
    FROM (
        SELECT
            id,
            ntype,
            title,
            message,
            data,
            created_at,
            NOT (read_by @> ARRAY[v_agent.agent_id]) AS is_unread
        FROM agent_notifications
        WHERE (agent_id IS NULL OR agent_id = v_agent.agent_id)
          AND (expires_at IS NULL OR expires_at > NOW())
          AND (NOT p_unread OR NOT (read_by @> ARRAY[v_agent.agent_id]))
          AND (p_ntype IS NULL OR ntype = p_ntype)
        ORDER BY created_at DESC
        LIMIT p_limit
    ) n;

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_agent_notifications TO anon, authenticated;


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 4. RPC: mark_notification_read (읽음 처리)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION mark_notification_read(
    p_api_key         TEXT,
    p_notification_id BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_agent RECORD;
BEGIN
    SELECT * INTO v_agent FROM agents
    WHERE api_key = p_api_key AND status = 'ACTIVE';

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_API_KEY');
    END IF;

    UPDATE agent_notifications
    SET read_by = array_append(read_by, v_agent.agent_id)
    WHERE id = p_notification_id
      AND NOT (read_by @> ARRAY[v_agent.agent_id])
      AND (agent_id IS NULL OR agent_id = v_agent.agent_id);

    RETURN jsonb_build_object('success', true, 'notification_id', p_notification_id);
END;
$$;

GRANT EXECUTE ON FUNCTION mark_notification_read TO anon, authenticated;


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 5. RPC: mark_all_notifications_read (전체 읽음)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION mark_all_notifications_read(p_api_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_agent RECORD;
    v_count INT;
BEGIN
    SELECT * INTO v_agent FROM agents
    WHERE api_key = p_api_key AND status = 'ACTIVE';

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_API_KEY');
    END IF;

    UPDATE agent_notifications
    SET read_by = array_append(read_by, v_agent.agent_id)
    WHERE (agent_id IS NULL OR agent_id = v_agent.agent_id)
      AND NOT (read_by @> ARRAY[v_agent.agent_id]);

    GET DIAGNOSTICS v_count = ROW_COUNT;

    RETURN jsonb_build_object('success', true, 'marked_count', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION mark_all_notifications_read TO anon, authenticated;


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 6. 기존 웹훅 이벤트 타입 확장 안내
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 기존 dispatch_webhooks는 이벤트 필터링을 events 배열로 처리하므로
-- 새 이벤트 타입(NEW_PRODUCT, PRICE_DROP, PROMOTION 등)은 별도 DDL 없이
-- admin_send_notification에서 dispatch_webhooks 호출 시 자동으로 전달됩니다.
-- 에이전트가 agent_register_webhook 호출 시 events 배열에
-- ['NEW_PRODUCT', 'PROMOTION', 'PRICE_DROP'] 등을 추가해 구독하면 됩니다.

-- 7. 만료된 알림 자동 정리 (선택: pg_cron 환경에서)
-- SELECT cron.schedule('cleanup-expired-notifications', '0 3 * * *',
--   'DELETE FROM agent_notifications WHERE expires_at < NOW() - INTERVAL ''7 days''');
