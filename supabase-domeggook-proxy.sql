-- ============================================
-- Domeggook API Proxy Functions
-- Bypasses CORS by calling API server-side
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
    RETURN v_body;
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
    RETURN v_body;
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
