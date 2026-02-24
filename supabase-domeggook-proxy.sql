-- ============================================
-- Domeggook API Proxy Functions
-- Bypasses CORS by calling API server-side
-- Includes standard error & rate limit handling
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable the http extension (for making HTTP requests from PostgreSQL)
CREATE EXTENSION IF NOT EXISTS http;

-- 1. Search products on Domeggook
CREATE OR REPLACE FUNCTION domeggook_search(
  p_keyword TEXT,
  p_page INTEGER DEFAULT 1,
  p_size INTEGER DEFAULT 20
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

  -- Build request URL
  v_url := 'https://domeggook.com/ssl/api/?ver=4.1&mode=getItemList'
    || '&aid=59a4d8f9efc963d6446f86615902e416'
    || '&market=dome&om=json'
    || '&sz=' || p_size::TEXT
    || '&pg=' || p_page::TEXT
    || '&kw=' || urlencode(p_keyword);

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
        'dmessage', v_body->'errors'->>'dmessage'
      );
    END IF;

    RETURN v_body;
  ELSIF v_response.status = 429 THEN
    -- Rate limit: 분당 180회 또는 일 15,000회 초과
    RETURN jsonb_build_object(
      'error', 'RATE_LIMIT',
      'code', '429',
      'message', 'API 호출 허용량 초과. 잠시 후 다시 시도해주세요.',
      'dmessage', '분당 180회 / 일 15,000회 제한'
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

-- 2. Get item detail from Domeggook
CREATE OR REPLACE FUNCTION domeggook_detail(
  p_item_no TEXT
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

  -- Build request URL
  v_url := 'https://domeggook.com/ssl/api/?ver=4.5&mode=getItemView'
    || '&aid=59a4d8f9efc963d6446f86615902e416'
    || '&no=' || p_item_no
    || '&om=json';

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
        'dmessage', v_body->'errors'->>'dmessage'
      );
    END IF;

    RETURN v_body;
  ELSIF v_response.status = 429 THEN
    RETURN jsonb_build_object(
      'error', 'RATE_LIMIT',
      'code', '429',
      'message', 'API 호출 허용량 초과. 잠시 후 다시 시도해주세요.',
      'dmessage', '분당 180회 / 일 15,000회 제한'
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

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION domeggook_search(TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION domeggook_detail(TEXT) TO authenticated;

-- Revoke from anon (API key should not be exposed)
REVOKE EXECUTE ON FUNCTION domeggook_search(TEXT, INTEGER, INTEGER) FROM anon;
REVOKE EXECUTE ON FUNCTION domeggook_detail(TEXT) FROM anon;
