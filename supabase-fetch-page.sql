-- ============================================
-- Fetch external product page content
-- Used by AI to analyze competitor product pages
-- Runs server-side to bypass CORS restrictions
-- Run this in Supabase SQL Editor
-- ============================================

CREATE OR REPLACE FUNCTION fetch_page_content(p_url TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_response http_response;
    v_content TEXT;
    v_status INT;
BEGIN
    -- Basic URL validation
    IF p_url IS NULL OR p_url = '' THEN
        RETURN jsonb_build_object('error', 'URL is required');
    END IF;

    IF NOT (p_url LIKE 'http://%' OR p_url LIKE 'https://%') THEN
        RETURN jsonb_build_object('error', 'URL must start with http:// or https://');
    END IF;

    -- Fetch the page
    BEGIN
        SELECT * INTO v_response FROM http_get(p_url);
        v_status := v_response.status;

        IF v_status = 200 THEN
            v_content := v_response.content;
            -- Truncate if too large (Gemini has token limits)
            IF length(v_content) > 50000 THEN
                v_content := left(v_content, 50000);
            END IF;

            RETURN jsonb_build_object(
                'success', true,
                'status', v_status,
                'content', v_content,
                'content_length', length(v_content)
            );
        ELSE
            RETURN jsonb_build_object(
                'error', 'HTTP error',
                'status', v_status
            );
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'error', 'Failed to fetch URL',
            'message', SQLERRM
        );
    END;
END;
$$;

GRANT EXECUTE ON FUNCTION fetch_page_content(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION fetch_page_content(TEXT) TO authenticated;
