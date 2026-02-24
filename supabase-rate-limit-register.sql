-- supabase-rate-limit-register.sql
-- agent_self_register에 IP/시간 기반 rate limiting 추가
-- 동일 IP에서 1시간 내 5회 이상 등록 시도 차단

-- 1. 등록 시도 로그 테이블 (없으면 생성)
CREATE TABLE IF NOT EXISTS agent_register_attempts (
    id          BIGSERIAL PRIMARY KEY,
    ip_addr     TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_register_attempts_ip_time
    ON agent_register_attempts (ip_addr, created_at DESC);

-- 2. Rate-limited agent_self_register 교체
CREATE OR REPLACE FUNCTION agent_self_register(
    p_agent_name  TEXT,
    p_capabilities TEXT[] DEFAULT '{}',
    p_contact_uri TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_agent_id  TEXT;
    v_ip        TEXT;
    v_attempts  INT;
BEGIN
    -- ── Rate Limit 체크 ───────────────────────────────────────────
    -- 클라이언트 IP는 request.headers에서 가져옴 (Supabase Edge에서만 가능)
    -- 여기선 현재 DB 세션 정보로 대체; Edge Function에서 호출 시 x-forward-for 헤더를 넘겨야 정확함
    v_ip := COALESCE(current_setting('request.headers', true)::jsonb->>'x-forwarded-for', 'unknown');

    SELECT COUNT(*) INTO v_attempts
    FROM agent_register_attempts
    WHERE ip_addr = v_ip
      AND created_at > NOW() - INTERVAL '1 hour';

    IF v_attempts >= 5 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'RATE_LIMIT_EXCEEDED',
            'message', '1시간 내 최대 5회 등록 가능합니다. 잠시 후 다시 시도하세요.'
        );
    END IF;

    -- ── 시도 기록 ────────────────────────────────────────────────
    INSERT INTO agent_register_attempts (ip_addr) VALUES (v_ip);

    -- ── 입력값 검증 ──────────────────────────────────────────────
    p_agent_name := TRIM(p_agent_name);
    IF p_agent_name = '' OR p_agent_name IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_NAME', 'message', '에이전트 이름이 필요합니다.');
    END IF;
    IF LENGTH(p_agent_name) > 100 THEN
        RETURN jsonb_build_object('success', false, 'error', 'NAME_TOO_LONG', 'message', '이름은 100자 이하여야 합니다.');
    END IF;

    -- ── 에이전트 생성 (PENDING 상태) ──────────────────────────────
    v_agent_id := 'AGT-' || UPPER(TO_HEX(FLOOR(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT));

    INSERT INTO agents (
        agent_id, name, status,
        capabilities, contact_uri,
        api_key, created_at
    ) VALUES (
        v_agent_id,
        p_agent_name,
        'PENDING_APPROVAL',
        p_capabilities,
        p_contact_uri,
        NULL,       -- API 키는 관리자 승인 후 발급
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'agent_id', v_agent_id,
        'status', 'PENDING_APPROVAL',
        'message', '등록 완료. 관리자 승인 후 API 키가 발급됩니다.'
    );
EXCEPTION
    WHEN unique_violation THEN
        RETURN jsonb_build_object('success', false, 'error', 'DUPLICATE', 'message', '이미 등록된 에이전트 이름입니다.');
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', 'INTERNAL_ERROR', 'message', SQLERRM);
END;
$$;

-- 3. 권한 (anon도 등록 가능, 단 rate limit 적용)
GRANT EXECUTE ON FUNCTION agent_self_register(TEXT, TEXT[], TEXT) TO anon, authenticated;

-- 4. 오래된 시도 기록 자동 정리 (선택: pg_cron 사용 가능 환경에서)
-- SELECT cron.schedule('cleanup-register-attempts', '0 * * * *',
--   'DELETE FROM agent_register_attempts WHERE created_at < NOW() - INTERVAL ''24 hours''');
