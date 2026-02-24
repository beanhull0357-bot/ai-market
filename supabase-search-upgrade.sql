-- ============================================
-- Domeggook Search RPC 업그레이드
-- 정렬, 카테고리, 가격범위, 필터 파라미터 추가
-- Run in Supabase SQL Editor
-- ============================================

-- Drop the old function signature first
DROP FUNCTION IF EXISTS domeggook_search(TEXT, INTEGER, INTEGER);

-- Re-create with expanded parameters
CREATE OR REPLACE FUNCTION domeggook_search(
  p_keyword TEXT DEFAULT '',
  p_page INTEGER DEFAULT 1,
  p_size INTEGER DEFAULT 20,
  p_sort TEXT DEFAULT '',
  p_category TEXT DEFAULT '',
  p_min_price INTEGER DEFAULT NULL,
  p_max_price INTEGER DEFAULT NULL,
  p_shipping TEXT DEFAULT '',
  p_origin TEXT DEFAULT '',
  p_good_seller BOOLEAN DEFAULT false,
  p_fast_delivery BOOLEAN DEFAULT false,
  p_market TEXT DEFAULT 'dome'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_url TEXT;
  v_response http_response;
  v_body JSONB;
BEGIN
  -- Auth check
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'AUTH_REQUIRED');
  END IF;

  -- Build base URL
  v_url := 'https://domeggook.com/ssl/api/?ver=4.1&mode=getItemList'
    || '&aid=59a4d8f9efc963d6446f86615902e416'
    || '&market=' || p_market
    || '&om=json'
    || '&sz=' || p_size::TEXT
    || '&pg=' || p_page::TEXT;

  -- Add keyword (required search condition)
  IF p_keyword != '' THEN
    v_url := v_url || '&kw=' || urlencode(p_keyword);
  END IF;

  -- Sort: se(정확도), rd(랭킹), ha(인기), aa(낮은가격), ad(높은가격), da(최신순)
  IF p_sort != '' THEN
    v_url := v_url || '&so=' || p_sort;
  END IF;

  -- Category: ex) 01_01_00_00_00
  IF p_category != '' THEN
    v_url := v_url || '&ca=' || p_category;
  END IF;

  -- Price range
  IF p_min_price IS NOT NULL THEN
    v_url := v_url || '&mnp=' || p_min_price::TEXT;
  END IF;
  IF p_max_price IS NOT NULL THEN
    v_url := v_url || '&mxp=' || p_max_price::TEXT;
  END IF;

  -- Shipping filter: S(무료배송), B(착불), P(선결제), C(선택가능)
  IF p_shipping != '' THEN
    v_url := v_url || '&who=' || p_shipping;
  END IF;

  -- Origin: kr(국내산), fr(국외산)
  IF p_origin != '' THEN
    v_url := v_url || '&org=' || p_origin;
  END IF;

  -- Good seller filter
  IF p_good_seller THEN
    v_url := v_url || '&sgd=true';
  END IF;

  -- Fast delivery filter
  IF p_fast_delivery THEN
    v_url := v_url || '&fdl=true';
  END IF;

  -- Make HTTP GET request
  SELECT * INTO v_response FROM http_get(v_url);

  -- Parse response
  IF v_response.status = 200 THEN
    v_body := v_response.content::JSONB;

    -- Check for Domeggook standard error response (errors key)
    IF v_body->'errors' IS NOT NULL THEN
      RETURN jsonb_build_object(
        'error', 'DOME_API_ERROR',
        'code', v_body->'errors'->>'code',
        'message', v_body->'errors'->>'message',
        'dcode', v_body->'errors'->>'dcode',
        'dmessage', v_body->'errors'->>'dmessage',
        'date', v_body->'errors'->>'date'
      );
    END IF;

    RETURN v_body;
  ELSIF v_response.status = 429 THEN
    -- Rate limit: 분당 180회 또는 일 15,000회 초과
    RETURN jsonb_build_object(
      'error', 'RATE_LIMIT',
      'code', '429',
      'message', 'API 호출 허용량을 초과했습니다. 잠시 후 다시 시도해주세요.',
      'dmessage', '분당 180회 이상 접속 시 3분, 일 15,000회 이상 접속 시 자정까지 차단됩니다.'
    );
  ELSE
    RETURN jsonb_build_object(
      'error', 'API_ERROR',
      'status', v_response.status,
      'message', 'Domeggook API returned status ' || v_response.status::TEXT
    );
  END IF;

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'error', 'REQUEST_FAILED',
    'message', SQLERRM
  );
END;
$$;

-- Grant permissions (new signature)
GRANT EXECUTE ON FUNCTION domeggook_search(TEXT, INTEGER, INTEGER, TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT, BOOLEAN, BOOLEAN, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION domeggook_search(TEXT, INTEGER, INTEGER, TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT, BOOLEAN, BOOLEAN, TEXT) FROM anon;
