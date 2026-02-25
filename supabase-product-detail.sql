-- ============================================
-- Product Detail JSONB Column Migration
-- AI 에이전트를 위한 구조화 상품 상세 설명
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Add product_detail JSONB column
ALTER TABLE products
ADD COLUMN IF NOT EXISTS product_detail JSONB DEFAULT '{}'::jsonb;

-- 2. Add detail_images TEXT[] column for multiple detail image URLs
ALTER TABLE products
ADD COLUMN IF NOT EXISTS detail_images TEXT[] DEFAULT '{}';

-- 3. Add ai_extracted BOOLEAN flag
ALTER TABLE products
ADD COLUMN IF NOT EXISTS ai_extracted BOOLEAN DEFAULT FALSE;

-- 4. Add seller_notes TEXT column for free-form seller appeal
ALTER TABLE products
ADD COLUMN IF NOT EXISTS seller_notes TEXT DEFAULT '';

COMMENT ON COLUMN products.product_detail IS '구조화된 상품 상세 정보 (AI 에이전트용). detail_level: commodity|standard|rich';
COMMENT ON COLUMN products.detail_images IS '상품 상세 이미지 URL 배열 (최대 10장)';
COMMENT ON COLUMN products.ai_extracted IS 'AI Vision으로 상세 정보 자동 추출 여부';
COMMENT ON COLUMN products.seller_notes IS '셀러 자유 어필 텍스트';

-- 5. Create index for product_detail queries
CREATE INDEX IF NOT EXISTS idx_products_detail_level
ON products ((product_detail->>'detail_level'));

-- 6. Update seller_upload_products RPC to include product_detail
-- (기존 RPC에 파라미터 추가 — 별도 RPC로 분리)
CREATE OR REPLACE FUNCTION update_product_detail(
    p_seller_key TEXT,
    p_sku TEXT,
    p_product_detail JSONB DEFAULT NULL,
    p_detail_images TEXT[] DEFAULT NULL,
    p_seller_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_seller RECORD;
    v_product RECORD;
BEGIN
    -- Authenticate seller
    SELECT * INTO v_seller FROM sellers WHERE api_key = p_seller_key AND active = TRUE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'INVALID_SELLER_KEY');
    END IF;

    -- Find product
    SELECT * INTO v_product FROM products WHERE sku = p_sku;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'PRODUCT_NOT_FOUND', 'sku', p_sku);
    END IF;

    -- Update product detail fields
    UPDATE products SET
        product_detail = COALESCE(p_product_detail, product_detail),
        detail_images = COALESCE(p_detail_images, detail_images),
        seller_notes = COALESCE(p_seller_notes, seller_notes),
        ai_extracted = CASE WHEN p_product_detail IS NOT NULL
                       AND (p_product_detail->>'extracted_by') IS NOT NULL THEN TRUE
                       ELSE ai_extracted END,
        updated_at = NOW()
    WHERE sku = p_sku;

    RETURN jsonb_build_object(
        'success', TRUE,
        'sku', p_sku,
        'detail_level', COALESCE(p_product_detail->>'detail_level', v_product.product_detail->>'detail_level', 'commodity')
    );
END;
$$;

GRANT EXECUTE ON FUNCTION update_product_detail(TEXT, TEXT, JSONB, TEXT[], TEXT) TO authenticated;
