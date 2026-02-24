-- supabase-fix-wallet-spend.sql
-- wallet_spend 함수 시그니처 통일:
--   Edge Function(jsonmart-api)에서 4개 인자로 호출하므로 
--   기존 3-param 버전을 대체하는 4-param 버전으로 통일.
--
-- 호출 예시 (jsonmart-api/index.ts):
--   supabase.rpc('wallet_spend', {
--     p_api_key: apiKey,
--     p_amount: totalPrice,
--     p_order_id: orderId,
--     p_description: '구매: 상품명 x1'
--   })

-- ① 기존 3-param 버전 삭제 (충돌 방지)
DROP FUNCTION IF EXISTS wallet_spend(text, bigint, text);
DROP FUNCTION IF EXISTS wallet_spend(text, numeric, text);

-- ② 4-param 버전으로 통일 정의
CREATE OR REPLACE FUNCTION wallet_spend(
    p_api_key    TEXT,
    p_amount     NUMERIC,
    p_order_id   TEXT,
    p_description TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_wallet_id     UUID;
    v_agent_id      TEXT;
    v_balance       NUMERIC;
    v_new_balance   NUMERIC;
BEGIN
    -- 1. API 키로 에이전트 + 지갑 조회
    SELECT w.id, w.agent_id, w.balance
    INTO   v_wallet_id, v_agent_id, v_balance
    FROM   agent_wallets w
    JOIN   agents a ON a.agent_id = w.agent_id
    WHERE  a.api_key = p_api_key
    LIMIT  1;

    IF v_wallet_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'AGENT_NOT_FOUND',
            'message', 'API 키에 해당하는 에이전트 지갑을 찾을 수 없습니다.'
        );
    END IF;

    -- 2. 잔액 확인
    IF v_balance < p_amount THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'INSUFFICIENT_BALANCE',
            'message', format('잔액 부족: 현재 %s원, 필요 %s원', v_balance, p_amount),
            'balance', v_balance,
            'required', p_amount
        );
    END IF;

    -- 3. 차감
    v_new_balance := v_balance - p_amount;

    UPDATE agent_wallets
    SET    balance    = v_new_balance,
           updated_at = NOW()
    WHERE  id = v_wallet_id;

    -- 4. 트랜잭션 기록
    INSERT INTO wallet_transactions (
        wallet_id, agent_id, type, amount,
        balance_before, balance_after,
        order_id, description, created_at
    ) VALUES (
        v_wallet_id, v_agent_id, 'SPEND', p_amount,
        v_balance, v_new_balance,
        p_order_id, p_description, NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'balance_before', v_balance,
        'balance_after',  v_new_balance,
        'amount_spent',   p_amount,
        'order_id',       p_order_id
    );
END;
$$;

-- ③ 권한 부여
REVOKE EXECUTE ON FUNCTION wallet_spend(text, numeric, text, text) FROM anon;
GRANT  EXECUTE ON FUNCTION wallet_spend(text, numeric, text, text) TO authenticated, service_role;
