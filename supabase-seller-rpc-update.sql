-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 셀러 상품 등록 RPC 업데이트
-- Supabase SQL Editor에 이 파일 전체를 붙여넣고 Run 클릭
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION seller_upload_products(
    p_api_key   TEXT,
    p_file_name TEXT,
    p_products  JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_seller    RECORD;
    v_product   JSONB;
    v_total     INT := 0;
    v_success   INT := 0;
    v_errors    JSONB := '[]'::JSONB;
    v_upload_id UUID;
    v_sku       TEXT;
    v_title     TEXT;
    v_category  TEXT;
    v_price     INT;
    v_stock     INT;
BEGIN
    SELECT * INTO v_seller FROM sellers WHERE api_key = p_api_key AND status = 'ACTIVE';
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid API key or inactive seller');
    END IF;

    v_total := jsonb_array_length(p_products);

    INSERT INTO seller_uploads (seller_id, file_name, total_rows, status)
    VALUES (v_seller.seller_id, p_file_name, v_total, 'PROCESSING')
    RETURNING id INTO v_upload_id;

    FOR i IN 0..v_total - 1 LOOP
        BEGIN
            v_product := p_products->i;
            v_sku := v_product->>'sku';
            v_title := v_product->>'title';
            v_category := COALESCE(v_product->>'category', 'CONSUMABLES');
            v_price := COALESCE((v_product->>'price')::INT, 0);
            v_stock := COALESCE((v_product->>'stock_qty')::INT, 0);

            IF v_sku IS NULL OR v_sku = '' THEN
                v_errors := v_errors || jsonb_build_object('row', i+1, 'field', 'sku', 'message', 'SKU is required');
                CONTINUE;
            END IF;
            IF v_title IS NULL OR v_title = '' THEN
                v_errors := v_errors || jsonb_build_object('row', i+1, 'field', 'title', 'message', 'Title is required');
                CONTINUE;
            END IF;
            IF v_price <= 0 THEN
                v_errors := v_errors || jsonb_build_object('row', i+1, 'field', 'price', 'message', 'Price must be positive');
                CONTINUE;
            END IF;

            INSERT INTO products (
                sku, category, title, brand, gtin, price, currency,
                stock_status, stock_qty, ship_by_days, eta_days,
                return_days, return_fee, return_exceptions,
                ai_readiness_score, seller_trust,
                attributes, sourcing_type, seller_id, seller_name,
                min_order_qty, delivery_fee, source
            ) VALUES (
                v_sku,
                v_category,
                v_title,
                COALESCE(v_product->>'brand', ''),
                v_product->>'gtin',
                v_price,
                'KRW',
                CASE WHEN v_stock > 0 THEN 'in_stock' ELSE 'out_of_stock' END,
                v_stock,
                COALESCE((v_product->>'ship_by_days')::INT, 1),
                COALESCE((v_product->>'eta_days')::INT, 3),
                COALESCE((v_product->>'return_days')::INT, 7),
                COALESCE((v_product->>'return_fee')::INT, 0),
                '{}',
                70,
                v_seller.trust_score,
                COALESCE((v_product->>'attributes')::JSONB, '{}'),
                'HUMAN',
                v_seller.seller_id,
                v_seller.business_name,
                COALESCE((v_product->>'min_order_qty')::INT, 1),
                COALESCE((v_product->>'delivery_fee')::JSONB, '{"pay":"무료배송","fee":0}'),
                'seller'
            )
            ON CONFLICT (sku) DO UPDATE SET
                title = EXCLUDED.title,
                category = EXCLUDED.category,
                brand = EXCLUDED.brand,
                price = EXCLUDED.price,
                stock_qty = EXCLUDED.stock_qty,
                stock_status = EXCLUDED.stock_status,
                ship_by_days = EXCLUDED.ship_by_days,
                eta_days = EXCLUDED.eta_days,
                return_days = EXCLUDED.return_days,
                return_fee = EXCLUDED.return_fee,
                attributes = EXCLUDED.attributes,
                delivery_fee = EXCLUDED.delivery_fee,
                seller_id = v_seller.seller_id,
                seller_name = v_seller.business_name,
                updated_at = NOW();

            v_success := v_success + 1;

        EXCEPTION WHEN OTHERS THEN
            v_errors := v_errors || jsonb_build_object('row', i+1, 'field', 'unknown', 'message', SQLERRM);
        END;
    END LOOP;

    UPDATE seller_uploads
    SET success_count = v_success,
        error_count = jsonb_array_length(v_errors),
        errors = v_errors,
        status = CASE WHEN v_success > 0 THEN 'COMPLETED' ELSE 'FAILED' END
    WHERE id = v_upload_id;

    UPDATE sellers
    SET total_products = (SELECT COUNT(*) FROM products WHERE products.seller_id = v_seller.seller_id),
        updated_at = NOW()
    WHERE seller_id = v_seller.seller_id;

    RETURN jsonb_build_object(
        'success', true,
        'upload_id', v_upload_id,
        'total_rows', v_total,
        'success_count', v_success,
        'error_count', jsonb_array_length(v_errors),
        'errors', v_errors
    );
END;
$$ ;

GRANT EXECUTE ON FUNCTION seller_upload_products TO anon, authenticated;

SELECT 'seller_upload_products RPC 업데이트 완료!' AS status;
