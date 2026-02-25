-- ============================================
-- AI Product Detail Extraction via Gemini 2.0 Flash
-- Supabase Database Function (RPC)
-- Uses the http extension (already enabled)
-- API Key is stored server-side — never exposed to frontend
-- Run this in Supabase SQL Editor
-- ============================================

-- Store API key securely in a config table
CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert Gemini API key (run once)
INSERT INTO app_config (key, value)
VALUES ('GEMINI_API_KEY', 'AIzaSyBA4PRs_bkI94nQb1E7cdCaEn0gBa3m_6c')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Revoke all access from public/anon — only functions can read this
REVOKE ALL ON app_config FROM anon;
REVOKE ALL ON app_config FROM authenticated;

-- ============================================
-- Main extraction function
-- Accepts: title, category, image URLs (optional)
-- Returns: structured JSON product detail
-- ============================================
CREATE OR REPLACE FUNCTION ai_extract_product_detail(
    p_title TEXT,
    p_category TEXT,
    p_image_urls TEXT[] DEFAULT '{}',
    p_schema_fields JSONB DEFAULT '[]'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_api_key TEXT;
    v_url TEXT;
    v_prompt TEXT;
    v_parts JSONB;
    v_request_body JSONB;
    v_response http_response;
    v_result JSONB;
    v_text_content TEXT;
    v_img_url TEXT;
    v_img_response http_response;
    v_img_base64 TEXT;
    v_img_parts JSONB := '[]'::jsonb;
    v_img_count INT := 0;
BEGIN
    -- Auth check
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('error', 'AUTH_REQUIRED');
    END IF;

    -- Get API key from secure config
    SELECT value INTO v_api_key FROM app_config WHERE key = 'GEMINI_API_KEY';
    IF v_api_key IS NULL THEN
        RETURN jsonb_build_object('error', 'GEMINI_API_KEY_NOT_SET');
    END IF;

    -- Build prompt
    v_prompt := format(
'You are an AI product detail extractor for a B2B wholesale marketplace.
Analyze the provided product information and any images to extract structured details.

Product Title: "%s"
Category: "%s"
Schema fields to extract: %s

Return a JSON object with this structure:
{
  "specs": { /* key-value pairs of product specifications */ },
  "features": [ /* notable product features */ ],
  "use_cases": [ /* suggested use cases */ ],
  "care_instructions": [ /* care/maintenance if applicable */ ],
  "warnings": [ /* any warnings */ ],
  "certifications": [ /* quality marks if detected */ ],
  "ai_summary": "한국어로 상품 한줄 요약",
  "confidence": 0.85
}

RULES:
1. Respond ONLY with valid JSON
2. Write ai_summary in Korean
3. Extract ALL visible text from images if provided
4. Confidence 0.0-1.0 based on extraction quality',
        p_title, p_category, p_schema_fields::text
    );

    -- Build parts array starting with text prompt
    v_parts := jsonb_build_array(jsonb_build_object('text', v_prompt));

    -- Try to fetch and attach images (up to 3 to stay within limits)
    IF array_length(p_image_urls, 1) > 0 THEN
        FOREACH v_img_url IN ARRAY p_image_urls[1:3]
        LOOP
            BEGIN
                SELECT * INTO v_img_response FROM http_get(v_img_url);
                IF v_img_response.status = 200 THEN
                    v_img_base64 := encode(v_img_response.content::bytea, 'base64');
                    v_parts := v_parts || jsonb_build_array(
                        jsonb_build_object(
                            'inlineData', jsonb_build_object(
                                'mimeType', COALESCE(
                                    (SELECT value FROM unnest(v_img_response.headers) WHERE field = 'content-type' LIMIT 1),
                                    'image/jpeg'
                                ),
                                'data', v_img_base64
                            )
                        )
                    );
                    v_img_count := v_img_count + 1;
                END IF;
            EXCEPTION WHEN OTHERS THEN
                -- Skip failed images, continue with others
                NULL;
            END;
        END LOOP;
    END IF;

    -- Build Gemini API request
    v_url := 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' || v_api_key;

    v_request_body := jsonb_build_object(
        'contents', jsonb_build_array(
            jsonb_build_object('parts', v_parts)
        ),
        'generationConfig', jsonb_build_object(
            'temperature', 0.2,
            'maxOutputTokens', 2048,
            'responseMimeType', 'application/json'
        )
    );

    -- Call Gemini API
    SELECT * INTO v_response FROM http((
        'POST',
        v_url,
        ARRAY[http_header('Content-Type', 'application/json')],
        'application/json',
        v_request_body::text
    )::http_request);

    IF v_response.status != 200 THEN
        RETURN jsonb_build_object(
            'error', 'GEMINI_API_ERROR',
            'status', v_response.status,
            'message', left(v_response.content, 500)
        );
    END IF;

    -- Parse Gemini response
    v_result := v_response.content::jsonb;
    v_text_content := v_result->'candidates'->0->'content'->'parts'->0->>'text';

    IF v_text_content IS NULL THEN
        RETURN jsonb_build_object('error', 'EMPTY_RESPONSE');
    END IF;

    -- Clean JSON response (remove markdown code fences if present)
    v_text_content := regexp_replace(v_text_content, '^```json\s*', '');
    v_text_content := regexp_replace(v_text_content, '\s*```$', '');
    v_text_content := trim(v_text_content);

    -- Parse and return
    BEGIN
        v_result := v_text_content::jsonb;
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'error', 'PARSE_ERROR',
            'message', 'Failed to parse AI response',
            'raw', left(v_text_content, 500)
        );
    END;

    RETURN jsonb_build_object(
        'success', true,
        'extracted_by', 'gemini-2.0-flash',
        'images_analyzed', v_img_count
    ) || v_result;

END;
$$;

-- Grant to authenticated users only
GRANT EXECUTE ON FUNCTION ai_extract_product_detail(TEXT, TEXT, TEXT[], JSONB) TO authenticated;
REVOKE EXECUTE ON FUNCTION ai_extract_product_detail(TEXT, TEXT, TEXT[], JSONB) FROM anon;

-- ============================================
-- Quick test (run after inserting API key):
-- SELECT ai_extract_product_detail('면혼합 볼캡 모자', '패션/모자');
-- ============================================
