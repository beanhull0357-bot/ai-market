-- ============================================
-- 도매꾹 Private API 전체 연동
-- JSONMart ↔ 도매꾹 자동 발주/배송/재고 동기화
-- Run this in Supabase SQL Editor
-- ============================================

CREATE EXTENSION IF NOT EXISTS http;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 1. 설정 테이블: 도매꾹 계정 & 세션 관리
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS domeggook_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  dome_id TEXT NOT NULL DEFAULT '',
  dome_pw TEXT NOT NULL DEFAULT '',
  session_id TEXT,
  session_cid TEXT,
  session_expires_at TIMESTAMPTZ,
  sid_renew_date BIGINT,
  grade TEXT,
  ip_address TEXT DEFAULT '127.0.0.1',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 초기 빈 행 삽입 (설정 페이지에서 업데이트)
INSERT INTO domeggook_config (id, dome_id, dome_pw) 
VALUES (1, '', '') 
ON CONFLICT (id) DO NOTHING;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 2. 주문 매핑 테이블: JSONMart ↔ 도매꾹 주문
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS domeggook_order_map (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  jsonmart_order_id TEXT NOT NULL,
  dome_order_no TEXT,
  dome_order_uid TEXT,
  dome_status TEXT,
  dome_status_mode TEXT,
  dome_tracking_company TEXT,
  dome_tracking_company_name TEXT,
  dome_tracking_code TEXT,
  dome_raw_response JSONB DEFAULT '{}',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dome_order_map_jm ON domeggook_order_map(jsonmart_order_id);
CREATE INDEX IF NOT EXISTS idx_dome_order_map_dome ON domeggook_order_map(dome_order_no);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 3. 동기화 로그
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS domeggook_sync_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,
  status TEXT DEFAULT 'success',
  detail JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 기존 procurement_status 확장 (delivered 추가)
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_procurement_status_check;
DO $$ BEGIN
  ALTER TABLE orders ADD CONSTRAINT orders_procurement_status_check 
    CHECK (procurement_status IN ('pending','exported','ordered','shipped','delivered','cancelled','error'));
EXCEPTION WHEN others THEN NULL;
END $$;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- API KEY 상수
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 모든 함수에서 사용하는 도매꾹 API KEY
-- ※ Supabase Vault에 저장하는 것을 권장하지만, 현재는 함수 내 상수로 사용

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 4. dome_login() — 도매꾹 로그인 & 세션 획득
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE OR REPLACE FUNCTION dome_login()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_config RECORD;
  v_response http_response;
  v_body JSONB;
  v_post_data TEXT;
  v_aid TEXT := '59a4d8f9efc963d6446f86615902e416';
BEGIN
  -- Admin check
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'AUTH_REQUIRED');
  END IF;

  SELECT * INTO v_config FROM domeggook_config WHERE id = 1;
  IF NOT FOUND OR v_config.dome_id = '' THEN
    RETURN jsonb_build_object('error', 'CONFIG_MISSING', 'message', '도매꾹 ID/PW를 먼저 설정해주세요.');
  END IF;

  -- POST body
  v_post_data := 'ver=4.1&mode=setLogin'
    || '&aid=' || v_aid
    || '&id=' || urlencode(v_config.dome_id)
    || '&pw=' || urlencode(v_config.dome_pw)
    || '&om=json'
    || '&loginKeep=on'
    || '&ip=' || COALESCE(v_config.ip_address, '127.0.0.1')
    || '&device=Third Party';

  SELECT * INTO v_response FROM http((
    'POST',
    'https://domeggook.com/ssl/api/',
    ARRAY[http_header('Content-Type', 'application/x-www-form-urlencoded')],
    'application/x-www-form-urlencoded',
    v_post_data
  )::http_request);

  IF v_response.status = 200 THEN
    v_body := v_response.content::JSONB;

    -- 에러 체크
    IF v_body->'domeggook'->'errors' IS NOT NULL THEN
      INSERT INTO domeggook_sync_log (action, status, detail)
      VALUES ('login', 'error', v_body->'domeggook'->'errors');
      RETURN jsonb_build_object(
        'error', 'LOGIN_FAILED',
        'code', v_body->'domeggook'->'errors'->>'code',
        'message', v_body->'domeggook'->'errors'->>'message'
      );
    END IF;

    -- 세션 저장
    UPDATE domeggook_config SET
      session_id = v_body->'domeggook'->>'sId',
      session_cid = v_body->'domeggook'->>'cId',
      sid_renew_date = (v_body->'domeggook'->>'sIdRenewDate')::BIGINT,
      grade = v_body->'domeggook'->>'grade',
      session_expires_at = now() + INTERVAL '30 days',
      updated_at = now()
    WHERE id = 1;

    INSERT INTO domeggook_sync_log (action, status, detail)
    VALUES ('login', 'success', jsonb_build_object('id', v_config.dome_id, 'grade', v_body->'domeggook'->>'grade'));

    RETURN jsonb_build_object(
      'success', true,
      'id', v_body->'domeggook'->>'id',
      'grade', v_body->'domeggook'->>'grade',
      'session_expires', (now() + INTERVAL '30 days')::TEXT
    );
  ELSE
    RETURN jsonb_build_object('error', 'HTTP_ERROR', 'status', v_response.status);
  END IF;

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', 'LOGIN_EXCEPTION', 'message', SQLERRM);
END;
$$;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 5. dome_ensure_session() — 세션 유효성 확인 & 자동 갱신
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE OR REPLACE FUNCTION dome_ensure_session()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_config RECORD;
  v_response http_response;
  v_body JSONB;
  v_post_data TEXT;
  v_login_result JSONB;
  v_aid TEXT := '59a4d8f9efc963d6446f86615902e416';
BEGIN
  SELECT * INTO v_config FROM domeggook_config WHERE id = 1;

  -- 세션 없으면 로그인
  IF v_config.session_id IS NULL OR v_config.session_expires_at < now() THEN
    v_login_result := dome_login();
    IF v_login_result->>'error' IS NOT NULL THEN
      RETURN v_login_result;
    END IF;
    SELECT * INTO v_config FROM domeggook_config WHERE id = 1;
  END IF;

  -- setLoginChk로 세션 갱신
  v_post_data := 'ver=4.0&mode=setLoginChk'
    || '&aid=' || v_aid
    || '&id=' || urlencode(v_config.dome_id)
    || '&sId=' || urlencode(v_config.session_id)
    || '&loginKeep=on'
    || '&sIdRenewDate=' || COALESCE(v_config.sid_renew_date::TEXT, '0')
    || '&om=json';

  SELECT * INTO v_response FROM http((
    'POST',
    'https://domeggook.com/ssl/api/',
    ARRAY[http_header('Content-Type', 'application/x-www-form-urlencoded')],
    'application/x-www-form-urlencoded',
    v_post_data
  )::http_request);

  IF v_response.status = 200 THEN
    v_body := v_response.content::JSONB;

    -- 에러 시 재로그인
    IF v_body->'domeggook'->'errors' IS NOT NULL THEN
      v_login_result := dome_login();
      IF v_login_result->>'error' IS NOT NULL THEN
        RETURN v_login_result;
      END IF;
      SELECT * INTO v_config FROM domeggook_config WHERE id = 1;
    ELSE
      -- 갱신 정보 저장
      UPDATE domeggook_config SET
        session_id = COALESCE(v_body->'domeggook'->>'sId', v_config.session_id),
        session_cid = COALESCE(v_body->'domeggook'->>'cId', v_config.session_cid),
        sid_renew_date = COALESCE((v_body->'domeggook'->>'sIdRenewDate')::BIGINT, v_config.sid_renew_date),
        updated_at = now()
      WHERE id = 1;
      SELECT * INTO v_config FROM domeggook_config WHERE id = 1;
    END IF;
  ELSE
    -- HTTP 에러 시 재로그인
    v_login_result := dome_login();
    IF v_login_result->>'error' IS NOT NULL THEN
      RETURN v_login_result;
    END IF;
    SELECT * INTO v_config FROM domeggook_config WHERE id = 1;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_config.session_id,
    'dome_id', v_config.dome_id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', 'SESSION_EXCEPTION', 'message', SQLERRM);
END;
$$;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 6. dome_get_asset() — 이머니/포인트 잔액 조회
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE OR REPLACE FUNCTION dome_get_asset()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session JSONB;
  v_config RECORD;
  v_response http_response;
  v_body JSONB;
  v_post_data TEXT;
  v_aid TEXT := '59a4d8f9efc963d6446f86615902e416';
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'AUTH_REQUIRED');
  END IF;

  v_session := dome_ensure_session();
  IF v_session->>'error' IS NOT NULL THEN RETURN v_session; END IF;

  SELECT * INTO v_config FROM domeggook_config WHERE id = 1;

  v_post_data := 'ver=1.0&mode=getMyAsset'
    || '&aid=' || v_aid
    || '&id=' || urlencode(v_config.dome_id)
    || '&sId=' || urlencode(v_config.session_id)
    || '&om=json';

  SELECT * INTO v_response FROM http((
    'POST',
    'https://domeggook.com/ssl/api/',
    ARRAY[http_header('Content-Type', 'application/x-www-form-urlencoded')],
    'application/x-www-form-urlencoded',
    v_post_data
  )::http_request);

  IF v_response.status = 200 THEN
    v_body := v_response.content::JSONB;
    IF v_body->'domeggook'->'errors' IS NOT NULL THEN
      RETURN jsonb_build_object('error', 'API_ERROR', 'detail', v_body->'domeggook'->'errors');
    END IF;
    RETURN jsonb_build_object(
      'success', true,
      'point', v_body->'domeggook'->'data'->>'currPoint',
      'emoney_total', v_body->'domeggook'->'data'->'currEmoney'->>'total',
      'emoney_cash', v_body->'domeggook'->'data'->'currEmoney'->>'cash'
    );
  END IF;

  RETURN jsonb_build_object('error', 'HTTP_ERROR', 'status', v_response.status);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', 'ASSET_EXCEPTION', 'message', SQLERRM);
END;
$$;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 7. dome_create_order() — JSONMart 주문 → 도매꾹 자동 발주
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE OR REPLACE FUNCTION dome_create_order(p_order_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session JSONB;
  v_config RECORD;
  v_order RECORD;
  v_product RECORD;
  v_response http_response;
  v_body JSONB;
  v_post_data TEXT;
  v_item_json TEXT;
  v_deli_json TEXT;
  v_dome_order_no TEXT;
  v_aid TEXT := '59a4d8f9efc963d6446f86615902e416';
BEGIN
  -- 세션 확인
  v_session := dome_ensure_session();
  IF v_session->>'error' IS NOT NULL THEN RETURN v_session; END IF;
  SELECT * INTO v_config FROM domeggook_config WHERE id = 1;

  -- 주문 조회
  SELECT * INTO v_order FROM orders WHERE order_id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'ORDER_NOT_FOUND', 'order_id', p_order_id);
  END IF;

  -- 이미 발주된 건 체크
  IF v_order.procurement_status IN ('ordered', 'shipped', 'delivered') THEN
    RETURN jsonb_build_object('error', 'ALREADY_ORDERED', 'procurement_status', v_order.procurement_status);
  END IF;

  -- 상품 조회 (도매꾹 상품만 발주 가능)
  SELECT * INTO v_product FROM products WHERE sku = v_order.sku;
  IF NOT FOUND OR v_product.source != 'domeggook' THEN
    RETURN jsonb_build_object('error', 'NOT_DOMEGGOOK_PRODUCT', 'sku', v_order.sku, 'source', COALESCE(v_product.source, 'unknown'));
  END IF;

  -- 수령인 정보 체크
  IF v_order.recipient_name IS NULL OR v_order.address IS NULL OR v_order.phone IS NULL THEN
    RETURN jsonb_build_object('error', 'MISSING_RECIPIENT_INFO', 'message', '수령인 이름, 주소, 전화번호가 필요합니다.');
  END IF;

  -- 도매꾹 setOrder API 호출
  -- item 파라미터: item[key]=JSON (key는 공급사 상품코드)
  v_item_json := json_build_object(
    'itemNo', v_product.source_id,
    'itemCnt', COALESCE(v_order.quantity, 1),
    'market', 'dome'
  )::TEXT;

  -- deliinfo 파라미터
  v_deli_json := json_build_object(
    'getName', v_order.recipient_name,
    'getPhone', COALESCE(v_order.phone, ''),
    'getMobile', COALESCE(v_order.phone, ''),
    'getZipcode', COALESCE(v_order.postal_code, ''),
    'getAddr', COALESCE(v_order.address, '') || ' ' || COALESCE(v_order.address_detail, ''),
    'deliReq', COALESCE(v_order.delivery_note, '')
  )::TEXT;

  v_post_data := 'ver=4.3&mode=setOrder'
    || '&aid=' || v_aid
    || '&id=' || urlencode(v_config.dome_id)
    || '&sId=' || urlencode(v_config.session_id)
    || '&receipt=0'
    || '&om=json'
    || '&item[' || COALESCE(v_product.source_id, '0') || ']=' || urlencode(v_item_json)
    || '&deliinfo=' || urlencode(v_deli_json);

  SELECT * INTO v_response FROM http((
    'POST',
    'https://domeggook.com/ssl/api/',
    ARRAY[http_header('Content-Type', 'application/x-www-form-urlencoded')],
    'application/x-www-form-urlencoded',
    v_post_data
  )::http_request);

  IF v_response.status = 200 THEN
    v_body := v_response.content::JSONB;

    -- 에러 체크
    IF v_body->'domeggook'->'errors' IS NOT NULL THEN
      UPDATE orders SET procurement_status = 'error' WHERE order_id = p_order_id;
      INSERT INTO domeggook_order_map (jsonmart_order_id, error_message, dome_raw_response)
      VALUES (p_order_id, v_body->'domeggook'->'errors'->>'message', v_body);
      INSERT INTO domeggook_sync_log (action, status, detail)
      VALUES ('create_order', 'error', jsonb_build_object('order_id', p_order_id, 'error', v_body->'domeggook'->'errors'));
      RETURN jsonb_build_object('error', 'DOME_ORDER_FAILED', 'detail', v_body->'domeggook'->'errors');
    END IF;

    v_dome_order_no := v_body->'domeggook'->'order'->>'orderNo';

    -- 매핑 저장
    INSERT INTO domeggook_order_map (jsonmart_order_id, dome_order_no, dome_status, dome_raw_response)
    VALUES (p_order_id, v_dome_order_no, '결제완료', v_body);

    -- 주문 상태 업데이트
    UPDATE orders SET
      procurement_status = 'ordered',
      updated_at = now()
    WHERE order_id = p_order_id;

    INSERT INTO domeggook_sync_log (action, status, detail)
    VALUES ('create_order', 'success', jsonb_build_object('order_id', p_order_id, 'dome_order_no', v_dome_order_no));

    RETURN jsonb_build_object(
      'success', true,
      'jsonmart_order_id', p_order_id,
      'dome_order_no', v_dome_order_no,
      'dome_item_no', v_body->'domeggook'->'order'->>'itemNo',
      'dome_recipient', v_body->'domeggook'->'order'->>'getName'
    );
  END IF;

  RETURN jsonb_build_object('error', 'HTTP_ERROR', 'status', v_response.status);

EXCEPTION WHEN OTHERS THEN
  UPDATE orders SET procurement_status = 'error' WHERE order_id = p_order_id;
  INSERT INTO domeggook_sync_log (action, status, detail)
  VALUES ('create_order', 'error', jsonb_build_object('order_id', p_order_id, 'message', SQLERRM));
  RETURN jsonb_build_object('error', 'ORDER_EXCEPTION', 'message', SQLERRM);
END;
$$;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 8. dome_get_buy_orders() — 구매 주문서 목록 조회
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE OR REPLACE FUNCTION dome_get_buy_orders(
  p_status TEXT DEFAULT NULL,
  p_day INTEGER DEFAULT 30,
  p_page INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session JSONB;
  v_config RECORD;
  v_response http_response;
  v_body JSONB;
  v_url TEXT;
  v_aid TEXT := '59a4d8f9efc963d6446f86615902e416';
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'AUTH_REQUIRED'); END IF;
  v_session := dome_ensure_session();
  IF v_session->>'error' IS NOT NULL THEN RETURN v_session; END IF;
  SELECT * INTO v_config FROM domeggook_config WHERE id = 1;

  v_url := 'https://domeggook.com/ssl/api/?ver=4.0&mode=getOrderList'
    || '&aid=' || v_aid
    || '&id=' || urlencode(v_config.dome_id)
    || '&sId=' || urlencode(v_config.session_id)
    || '&for=buy&om=json'
    || '&day=' || p_day::TEXT
    || '&pg=' || p_page::TEXT;

  IF p_status IS NOT NULL THEN
    v_url := v_url || '&st=' || urlencode(p_status);
  END IF;

  SELECT * INTO v_response FROM http_get(v_url);

  IF v_response.status = 200 THEN
    v_body := v_response.content::JSONB;
    IF v_body->'domeggook'->'errors' IS NOT NULL THEN
      RETURN jsonb_build_object('error', 'API_ERROR', 'detail', v_body->'domeggook'->'errors');
    END IF;
    RETURN v_body->'domeggook';
  END IF;

  RETURN jsonb_build_object('error', 'HTTP_ERROR', 'status', v_response.status);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', 'EXCEPTION', 'message', SQLERRM);
END;
$$;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 9. dome_get_buy_order_detail() — 구매 주문서 상세 (배송추적)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE OR REPLACE FUNCTION dome_get_buy_order_detail(p_order_no TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session JSONB;
  v_config RECORD;
  v_response http_response;
  v_body JSONB;
  v_url TEXT;
  v_aid TEXT := '59a4d8f9efc963d6446f86615902e416';
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'AUTH_REQUIRED'); END IF;
  v_session := dome_ensure_session();
  IF v_session->>'error' IS NOT NULL THEN RETURN v_session; END IF;
  SELECT * INTO v_config FROM domeggook_config WHERE id = 1;

  v_url := 'https://domeggook.com/ssl/api/?ver=4.0&mode=getOrderView'
    || '&aid=' || v_aid
    || '&id=' || urlencode(v_config.dome_id)
    || '&sId=' || urlencode(v_config.session_id)
    || '&for=buy&om=json'
    || '&no=' || p_order_no;

  SELECT * INTO v_response FROM http_get(v_url);

  IF v_response.status = 200 THEN
    v_body := v_response.content::JSONB;
    IF v_body->'domeggook'->'errors' IS NOT NULL THEN
      RETURN jsonb_build_object('error', 'API_ERROR', 'detail', v_body->'domeggook'->'errors');
    END IF;
    RETURN v_body->'domeggook';
  END IF;

  RETURN jsonb_build_object('error', 'HTTP_ERROR', 'status', v_response.status);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', 'EXCEPTION', 'message', SQLERRM);
END;
$$;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 10. dome_cancel_order() — 구매취소 신청
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE OR REPLACE FUNCTION dome_cancel_order(p_order_no TEXT, p_memo TEXT DEFAULT '고객 취소 요청')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session JSONB;
  v_config RECORD;
  v_response http_response;
  v_body JSONB;
  v_post_data TEXT;
  v_aid TEXT := '59a4d8f9efc963d6446f86615902e416';
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'AUTH_REQUIRED'); END IF;
  v_session := dome_ensure_session();
  IF v_session->>'error' IS NOT NULL THEN RETURN v_session; END IF;
  SELECT * INTO v_config FROM domeggook_config WHERE id = 1;

  v_post_data := 'ver=1.0&mode=setOrdDeny'
    || '&aid=' || v_aid
    || '&id=' || urlencode(v_config.dome_id)
    || '&sId=' || urlencode(v_config.session_id)
    || '&type=buy'
    || '&no=' || p_order_no
    || '&memo=' || urlencode(p_memo);

  SELECT * INTO v_response FROM http((
    'POST',
    'https://domeggook.com/ssl/api/',
    ARRAY[http_header('Content-Type', 'application/x-www-form-urlencoded')],
    'application/x-www-form-urlencoded',
    v_post_data
  )::http_request);

  IF v_response.status = 200 THEN
    v_body := v_response.content::JSONB;
    IF v_body->'domeggook'->'errors' IS NOT NULL THEN
      RETURN jsonb_build_object('error', 'CANCEL_FAILED', 'detail', v_body->'domeggook'->'errors');
    END IF;

    -- 매핑 테이블 업데이트
    UPDATE domeggook_order_map SET
      dome_status = '구매취소',
      updated_at = now()
    WHERE dome_order_no = p_order_no;

    INSERT INTO domeggook_sync_log (action, status, detail)
    VALUES ('cancel_order', 'success', jsonb_build_object('dome_order_no', p_order_no, 'result', v_body->'domeggook'->>'result'));

    RETURN jsonb_build_object('success', true, 'result', v_body->'domeggook'->>'result');
  END IF;

  RETURN jsonb_build_object('error', 'HTTP_ERROR', 'status', v_response.status);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', 'EXCEPTION', 'message', SQLERRM);
END;
$$;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 11. dome_sync_order_status() — 진행중 주문 상태 일괄 동기화
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE OR REPLACE FUNCTION dome_sync_order_status()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session JSONB;
  v_map RECORD;
  v_detail JSONB;
  v_dome_status TEXT;
  v_dome_status_mode TEXT;
  v_tracking_company TEXT;
  v_tracking_code TEXT;
  v_synced INTEGER := 0;
  v_errors INTEGER := 0;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'AUTH_REQUIRED'); END IF;
  v_session := dome_ensure_session();
  IF v_session->>'error' IS NOT NULL THEN RETURN v_session; END IF;

  -- 미완료 주문들 동기화
  FOR v_map IN
    SELECT m.*, o.order_id AS jm_order_id
    FROM domeggook_order_map m
    JOIN orders o ON o.order_id = m.jsonmart_order_id
    WHERE o.procurement_status IN ('ordered', 'shipped')
      AND m.dome_order_no IS NOT NULL
  LOOP
    BEGIN
      v_detail := dome_get_buy_order_detail(v_map.dome_order_no);

      IF v_detail->>'error' IS NOT NULL THEN
        v_errors := v_errors + 1;
        CONTINUE;
      END IF;

      v_dome_status := v_detail->'items'->>'status';
      v_dome_status_mode := v_detail->'items'->>'statusMode';
      v_tracking_company := v_detail->'items'->'delivery'->>'companyName';
      v_tracking_code := v_detail->'items'->'delivery'->>'code';

      -- 매핑 업데이트
      UPDATE domeggook_order_map SET
        dome_status = v_dome_status,
        dome_status_mode = v_dome_status_mode,
        dome_tracking_company = COALESCE(v_detail->'items'->'delivery'->>'company', dome_tracking_company),
        dome_tracking_company_name = COALESCE(v_tracking_company, dome_tracking_company_name),
        dome_tracking_code = COALESCE(v_tracking_code, dome_tracking_code),
        updated_at = now()
      WHERE id = v_map.id;

      -- JSONMart 주문 상태 업데이트
      IF v_dome_status_mode IN ('WAITDELI', 'WAITRCPT') THEN
        -- 배송중 또는 도착
        UPDATE orders SET
          procurement_status = 'shipped',
          tracking_number = COALESCE(v_tracking_code, tracking_number),
          status = CASE 
            WHEN status IN ('CONFIRMED', 'ORDER_CREATED') THEN 'SHIPPED'
            ELSE status
          END,
          updated_at = now()
        WHERE order_id = v_map.jsonmart_order_id;
      ELSIF v_dome_status_mode = 'DONE' THEN
        -- 구매종료 (배송 완료)
        UPDATE orders SET
          procurement_status = 'delivered',
          tracking_number = COALESCE(v_tracking_code, tracking_number),
          status = 'DELIVERED',
          updated_at = now()
        WHERE order_id = v_map.jsonmart_order_id;
      ELSIF v_dome_status_mode IN ('DENYBUY', 'DENYSELL') THEN
        -- 취소
        UPDATE orders SET
          procurement_status = 'cancelled',
          updated_at = now()
        WHERE order_id = v_map.jsonmart_order_id;
      END IF;

      v_synced := v_synced + 1;

    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
    END;
  END LOOP;

  INSERT INTO domeggook_sync_log (action, status, detail)
  VALUES ('sync_order_status', 'success', jsonb_build_object('synced', v_synced, 'errors', v_errors));

  RETURN jsonb_build_object('success', true, 'synced', v_synced, 'errors', v_errors);
END;
$$;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 12. dome_check_soldout() — 품절/가격변경 확인 → products 업데이트
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE OR REPLACE FUNCTION dome_check_soldout(
  p_status TEXT DEFAULT 'SOLDOUT_CLOSE_DEL_AMT',
  p_page INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session JSONB;
  v_config RECORD;
  v_response http_response;
  v_body JSONB;
  v_url TEXT;
  v_items JSONB;
  v_item JSONB;
  v_updated INTEGER := 0;
  v_aid TEXT := '59a4d8f9efc963d6446f86615902e416';
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'AUTH_REQUIRED'); END IF;
  v_session := dome_ensure_session();
  IF v_session->>'error' IS NOT NULL THEN RETURN v_session; END IF;
  SELECT * INTO v_config FROM domeggook_config WHERE id = 1;

  v_url := 'https://domeggook.com/ssl/api/?ver=1.0&mode=getAllSupplyChk'
    || '&aid=' || v_aid
    || '&type=all&om=json'
    || '&status=' || urlencode(p_status)
    || '&pg=' || p_page::TEXT;

  SELECT * INTO v_response FROM http_get(v_url);

  IF v_response.status = 200 THEN
    v_body := v_response.content::JSONB;
    IF v_body->'domeggook'->'errors' IS NOT NULL THEN
      RETURN jsonb_build_object('error', 'API_ERROR', 'detail', v_body->'domeggook'->'errors');
    END IF;

    v_items := v_body->'domeggook'->'items';
    IF v_items IS NOT NULL AND jsonb_typeof(v_items) = 'array' THEN
      FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
      LOOP
        -- 상품 상태별 업데이트
        IF v_item->>'status' = 'SOLDOUT' THEN
          UPDATE products SET
            stock_status = 'out_of_stock',
            stock_qty = 0,
            last_synced_at = now(),
            updated_at = now()
          WHERE source = 'domeggook' AND source_id = v_item->>'no';
        ELSIF v_item->>'status' = 'CLOSE' THEN
          UPDATE products SET
            stock_status = 'out_of_stock',
            last_synced_at = now(),
            updated_at = now()
          WHERE source = 'domeggook' AND source_id = v_item->>'no';
        ELSIF v_item->>'status' = 'DEL' THEN
          UPDATE products SET
            stock_status = 'out_of_stock',
            last_synced_at = now(),
            updated_at = now()
          WHERE source = 'domeggook' AND source_id = v_item->>'no';
        ELSIF v_item->>'status' = 'AMT' THEN
          -- 가격 변경 → cost_price 업데이트 & selling price 재계산
          UPDATE products SET
            cost_price = (v_item->>'price')::INTEGER,
            price = CEIL((v_item->>'price')::INTEGER * (1 + COALESCE(margin_rate, 20) / 100.0) / 10.0) * 10,
            last_synced_at = now(),
            updated_at = now()
          WHERE source = 'domeggook' AND source_id = v_item->>'no';
        ELSIF v_item->>'status' IN ('OPEN', 'RESTART') THEN
          UPDATE products SET
            stock_status = 'in_stock',
            last_synced_at = now(),
            updated_at = now()
          WHERE source = 'domeggook' AND source_id = v_item->>'no';
        END IF;

        IF FOUND THEN v_updated := v_updated + 1; END IF;
      END LOOP;
    END IF;

    INSERT INTO domeggook_sync_log (action, status, detail)
    VALUES ('check_soldout', 'success', jsonb_build_object(
      'updated', v_updated,
      'total_items', COALESCE(v_body->'domeggook'->'header'->>'numberOfItems', '0'),
      'page', p_page
    ));

    RETURN jsonb_build_object(
      'success', true,
      'updated', v_updated,
      'total_items', v_body->'domeggook'->'header'->>'numberOfItems',
      'current_page', p_page,
      'total_pages', v_body->'domeggook'->'header'->>'numberOfPages'
    );
  END IF;

  RETURN jsonb_build_object('error', 'HTTP_ERROR', 'status', v_response.status);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', 'EXCEPTION', 'message', SQLERRM);
END;
$$;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 13. dome_get_return() — 반품/교환 내역 조회
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE OR REPLACE FUNCTION dome_get_return(p_order_no TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session JSONB;
  v_config RECORD;
  v_response http_response;
  v_body JSONB;
  v_post_data TEXT;
  v_aid TEXT := '59a4d8f9efc963d6446f86615902e416';
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'AUTH_REQUIRED'); END IF;
  v_session := dome_ensure_session();
  IF v_session->>'error' IS NOT NULL THEN RETURN v_session; END IF;
  SELECT * INTO v_config FROM domeggook_config WHERE id = 1;

  v_post_data := 'ver=1.0&mode=getOrderReturn'
    || '&aid=' || v_aid
    || '&id=' || urlencode(v_config.dome_id)
    || '&sId=' || urlencode(v_config.session_id)
    || '&orderNo=' || p_order_no
    || '&om=json';

  SELECT * INTO v_response FROM http((
    'POST',
    'https://domeggook.com/ssl/api/',
    ARRAY[http_header('Content-Type', 'application/x-www-form-urlencoded')],
    'application/x-www-form-urlencoded',
    v_post_data
  )::http_request);

  IF v_response.status = 200 THEN
    v_body := v_response.content::JSONB;
    IF v_body->'domeggook'->'errors' IS NOT NULL THEN
      RETURN jsonb_build_object('error', 'API_ERROR', 'detail', v_body->'domeggook'->'errors');
    END IF;
    RETURN v_body->'domeggook';
  END IF;

  RETURN jsonb_build_object('error', 'HTTP_ERROR', 'status', v_response.status);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', 'EXCEPTION', 'message', SQLERRM);
END;
$$;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 14. dome_save_config() — 관리 페이지에서 도매꾹 설정 저장
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE OR REPLACE FUNCTION dome_save_config(
  p_dome_id TEXT,
  p_dome_pw TEXT,
  p_ip TEXT DEFAULT '127.0.0.1'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'AUTH_REQUIRED'); END IF;

  INSERT INTO domeggook_config (id, dome_id, dome_pw, ip_address)
  VALUES (1, p_dome_id, p_dome_pw, p_ip)
  ON CONFLICT (id) DO UPDATE SET
    dome_id = p_dome_id,
    dome_pw = p_dome_pw,
    ip_address = p_ip,
    session_id = NULL,
    session_cid = NULL,
    session_expires_at = NULL,
    updated_at = now();

  RETURN jsonb_build_object('success', true, 'message', '설정 저장 완료. 로그인을 진행해주세요.');
END;
$$;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 15. dome_get_config() — 현재 설정 조회 (PW 마스킹)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE OR REPLACE FUNCTION dome_get_config()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_config RECORD;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'AUTH_REQUIRED'); END IF;

  SELECT * INTO v_config FROM domeggook_config WHERE id = 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('dome_id', '', 'has_password', false, 'session_active', false);
  END IF;

  RETURN jsonb_build_object(
    'dome_id', v_config.dome_id,
    'has_password', (v_config.dome_pw IS NOT NULL AND v_config.dome_pw != ''),
    'session_active', (v_config.session_id IS NOT NULL AND v_config.session_expires_at > now()),
    'session_expires_at', v_config.session_expires_at,
    'grade', v_config.grade,
    'ip_address', v_config.ip_address,
    'updated_at', v_config.updated_at
  );
END;
$$;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 16. dome_get_pending_orders() — 미발주 도매꾹 주문 조회 (관리용)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE OR REPLACE FUNCTION dome_get_pending_orders()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_orders JSONB;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'AUTH_REQUIRED'); END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'order_id', o.order_id,
    'sku', o.sku,
    'product_title', o.product_title,
    'quantity', o.quantity,
    'total_price', o.total_price,
    'recipient_name', o.recipient_name,
    'address', o.address,
    'phone', o.phone,
    'procurement_status', o.procurement_status,
    'created_at', o.created_at,
    'source_id', p.source_id
  ) ORDER BY o.created_at)
  INTO v_orders
  FROM orders o
  JOIN products p ON p.sku = o.sku
  WHERE p.source = 'domeggook'
    AND o.procurement_status = 'pending'
    AND o.payment_status IN ('CAPTURED', 'PAID');

  RETURN jsonb_build_object('success', true, 'orders', COALESCE(v_orders, '[]'::JSONB));
END;
$$;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 17. dome_bulk_order() — 미발주 건 일괄 발주
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE OR REPLACE FUNCTION dome_bulk_order()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order RECORD;
  v_result JSONB;
  v_success INTEGER := 0;
  v_fail INTEGER := 0;
  v_results JSONB := '[]'::JSONB;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'AUTH_REQUIRED'); END IF;

  FOR v_order IN
    SELECT o.order_id
    FROM orders o
    JOIN products p ON p.sku = o.sku
    WHERE p.source = 'domeggook'
      AND o.procurement_status = 'pending'
      AND o.payment_status IN ('CAPTURED', 'PAID')
    ORDER BY o.created_at
  LOOP
    v_result := dome_create_order(v_order.order_id);
    IF v_result->>'success' = 'true' THEN
      v_success := v_success + 1;
    ELSE
      v_fail := v_fail + 1;
    END IF;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'order_id', v_order.order_id,
      'result', v_result
    ));
  END LOOP;

  INSERT INTO domeggook_sync_log (action, status, detail)
  VALUES ('bulk_order', 'success', jsonb_build_object('success', v_success, 'fail', v_fail));

  RETURN jsonb_build_object('success', true, 'ordered', v_success, 'failed', v_fail, 'details', v_results);
END;
$$;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- RLS & 권한 설정
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALTER TABLE domeggook_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE domeggook_order_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE domeggook_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read dome_config" ON domeggook_config FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth update dome_config" ON domeggook_config FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth insert dome_config" ON domeggook_config FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Auth read dome_order_map" ON domeggook_order_map FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth insert dome_order_map" ON domeggook_order_map FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth update dome_order_map" ON domeggook_order_map FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Auth read dome_sync_log" ON domeggook_sync_log FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth insert dome_sync_log" ON domeggook_sync_log FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 함수 권한
GRANT EXECUTE ON FUNCTION dome_save_config(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION dome_get_config() TO authenticated;
GRANT EXECUTE ON FUNCTION dome_login() TO authenticated;
GRANT EXECUTE ON FUNCTION dome_ensure_session() TO authenticated;
GRANT EXECUTE ON FUNCTION dome_get_asset() TO authenticated;
GRANT EXECUTE ON FUNCTION dome_create_order(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION dome_get_buy_orders(TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION dome_get_buy_order_detail(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION dome_cancel_order(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION dome_sync_order_status() TO authenticated;
GRANT EXECUTE ON FUNCTION dome_check_soldout(TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION dome_get_return(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION dome_get_pending_orders() TO authenticated;
GRANT EXECUTE ON FUNCTION dome_bulk_order() TO authenticated;

-- anon 에서는 접근 불가
REVOKE EXECUTE ON FUNCTION dome_login() FROM anon;
REVOKE EXECUTE ON FUNCTION dome_create_order(TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION dome_bulk_order() FROM anon;
