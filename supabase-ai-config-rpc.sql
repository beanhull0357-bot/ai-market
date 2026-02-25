-- ============================================
-- Secure RPC to fetch AI config values
-- Only returns safe config keys (whitelist)
-- Run this in Supabase SQL Editor
-- ============================================

CREATE OR REPLACE FUNCTION get_ai_config(p_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_value TEXT;
    v_allowed_keys TEXT[] := ARRAY['GEMINI_API_KEY', 'IMGBB_API_KEY'];
BEGIN
    -- Only allow whitelisted config keys
    IF NOT (p_key = ANY(v_allowed_keys)) THEN
        RETURN NULL;
    END IF;

    SELECT value INTO v_value FROM app_config WHERE key = p_key;
    RETURN v_value;
END;
$$;

-- Allow both anon and authenticated to call
-- (anon needed for pre-login product browsing, authenticated for seller center)
GRANT EXECUTE ON FUNCTION get_ai_config(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_ai_config(TEXT) TO authenticated;
