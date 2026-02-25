-- ============================================
-- Multi-Seller Marketplace Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- ━━━ 1. Sellers Table ━━━
CREATE TABLE IF NOT EXISTS sellers (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    seller_id       TEXT UNIQUE NOT NULL,
    email           TEXT UNIQUE NOT NULL,
    business_name   TEXT NOT NULL,
    representative  TEXT NOT NULL,
    business_number TEXT,
    phone           TEXT,
    category_tags   TEXT[] DEFAULT '{}',

    -- Performance Metrics
    trust_score     INT DEFAULT 50,
    total_products  INT DEFAULT 0,
    total_sales     INT DEFAULT 0,
    total_revenue   BIGINT DEFAULT 0,
    avg_ship_days   NUMERIC(3,1) DEFAULT 3.0,
    return_rate     NUMERIC(5,2) DEFAULT 0.00,

    -- Status
    status          TEXT DEFAULT 'PENDING'
        CHECK (status IN ('PENDING','ACTIVE','SUSPENDED','BANNED')),
    api_key         TEXT,

    -- Settlement
    bank_name       TEXT,
    bank_account    TEXT,
    settlement_cycle TEXT DEFAULT 'MONTHLY'
        CHECK (settlement_cycle IN ('WEEKLY','BIWEEKLY','MONTHLY')),
    commission_rate  NUMERIC(5,2) DEFAULT 10.00,

    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ━━━ 2. Extend Products Table ━━━
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'seller_id') THEN
        ALTER TABLE products ADD COLUMN seller_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'seller_name') THEN
        ALTER TABLE products ADD COLUMN seller_name TEXT DEFAULT 'JSONMart';
    END IF;
END $$;

-- Default seller for existing products
INSERT INTO sellers (seller_id, email, business_name, representative, business_number, status, trust_score, api_key, commission_rate)
VALUES ('SLR-JSONMART', 'admin@jsonmart.xyz', 'JSONMart Official', 'JSONMart', '000-00-00000', 'ACTIVE', 100, 'slk_jsonmart_official', 0.00)
ON CONFLICT (seller_id) DO NOTHING;

UPDATE products SET seller_id = 'SLR-JSONMART', seller_name = 'JSONMart Official' WHERE seller_id IS NULL;

-- ━━━ 3. Seller Upload History ━━━
CREATE TABLE IF NOT EXISTS seller_uploads (
    id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    seller_id     TEXT NOT NULL,
    file_name     TEXT NOT NULL,
    total_rows    INT DEFAULT 0,
    success_count INT DEFAULT 0,
    error_count   INT DEFAULT 0,
    errors        JSONB DEFAULT '[]',
    status        TEXT DEFAULT 'PROCESSING'
        CHECK (status IN ('PROCESSING','COMPLETED','FAILED')),
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ━━━ 4. Indexes ━━━
CREATE INDEX IF NOT EXISTS idx_sellers_status ON sellers(status);
CREATE INDEX IF NOT EXISTS idx_sellers_email ON sellers(email);
CREATE INDEX IF NOT EXISTS idx_products_seller ON products(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_uploads_seller ON seller_uploads(seller_id);

-- ━━━ 5. RLS ━━━
ALTER TABLE sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read sellers" ON sellers FOR SELECT USING (true);
CREATE POLICY "Authenticated manage sellers" ON sellers FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated update sellers" ON sellers FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Public read uploads" ON seller_uploads FOR SELECT USING (true);
CREATE POLICY "Authenticated insert uploads" ON seller_uploads FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated update uploads" ON seller_uploads FOR UPDATE USING (true) WITH CHECK (true);

-- ━━━ 6. RPC: seller_register ━━━
CREATE OR REPLACE FUNCTION seller_register(
    p_email           TEXT,
    p_business_name   TEXT,
    p_representative  TEXT,
    p_business_number TEXT DEFAULT NULL,
    p_phone           TEXT DEFAULT NULL,
    p_category_tags   TEXT[] DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_seller_id TEXT;
    v_api_key   TEXT;
BEGIN
    -- Validate
    IF p_email IS NULL OR p_email = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Email is required');
    END IF;
    IF p_business_name IS NULL OR p_business_name = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Business name is required');
    END IF;

    -- Check duplicate
    IF EXISTS (SELECT 1 FROM sellers WHERE email = p_email) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Email already registered');
    END IF;

    -- Generate IDs
    v_seller_id := 'SLR-' || UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 6));
    v_api_key := 'slk_' || SUBSTR(MD5(RANDOM()::TEXT || NOW()::TEXT), 1, 24);

    INSERT INTO sellers (seller_id, email, business_name, representative, business_number, phone, category_tags, api_key)
    VALUES (v_seller_id, p_email, p_business_name, p_representative, p_business_number, p_phone, p_category_tags, v_api_key);

    RETURN jsonb_build_object(
        'success', true,
        'seller_id', v_seller_id,
        'api_key', v_api_key,
        'status', 'PENDING',
        'message', 'Registration submitted. Awaiting admin approval.'
    );
END;
$$;

-- ━━━ 7. RPC: seller_auth ━━━
CREATE OR REPLACE FUNCTION seller_auth(p_api_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_seller RECORD;
BEGIN
    SELECT * INTO v_seller FROM sellers WHERE api_key = p_api_key;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid API key');
    END IF;

    IF v_seller.status != 'ACTIVE' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Seller account is ' || v_seller.status);
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'seller_id', v_seller.seller_id,
        'business_name', v_seller.business_name,
        'trust_score', v_seller.trust_score,
        'total_products', v_seller.total_products,
        'total_sales', v_seller.total_sales,
        'total_revenue', v_seller.total_revenue,
        'commission_rate', v_seller.commission_rate,
        'status', v_seller.status
    );
END;
$$;

-- ━━━ 8. RPC: seller_upload_products ━━━
CREATE OR REPLACE FUNCTION seller_upload_products(
    p_api_key   TEXT,
    p_file_name TEXT,
    p_products  JSONB  -- Array of product objects
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
    -- Authenticate seller
    SELECT * INTO v_seller FROM sellers WHERE api_key = p_api_key AND status = 'ACTIVE';
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid API key or inactive seller');
    END IF;

    v_total := jsonb_array_length(p_products);

    -- Create upload record
    INSERT INTO seller_uploads (seller_id, file_name, total_rows, status)
    VALUES (v_seller.seller_id, p_file_name, v_total, 'PROCESSING')
    RETURNING id INTO v_upload_id;

    -- Process each product
    FOR i IN 0..v_total - 1 LOOP
        BEGIN
            v_product := p_products->i;
            v_sku := v_product->>'sku';
            v_title := v_product->>'title';
            v_category := COALESCE(v_product->>'category', 'CONSUMABLES');
            v_price := COALESCE((v_product->>'price')::INT, 0);
            v_stock := COALESCE((v_product->>'stock_qty')::INT, 0);

            -- Validate required fields
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

            -- Upsert product (update if SKU exists for same seller)
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

    -- Update upload record
    UPDATE seller_uploads
    SET success_count = v_success,
        error_count = jsonb_array_length(v_errors),
        errors = v_errors,
        status = CASE WHEN v_success > 0 THEN 'COMPLETED' ELSE 'FAILED' END
    WHERE id = v_upload_id;

    -- Update seller product count
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
$$;

-- ━━━ 9. RPC: seller_dashboard_stats ━━━
CREATE OR REPLACE FUNCTION seller_dashboard_stats(p_api_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_seller RECORD;
    v_product_stats JSONB;
    v_category_dist JSONB;
    v_recent_uploads JSONB;
BEGIN
    SELECT * INTO v_seller FROM sellers WHERE api_key = p_api_key AND status = 'ACTIVE';
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid API key or inactive seller');
    END IF;

    -- Product stats
    SELECT jsonb_build_object(
        'total', COUNT(*),
        'in_stock', COUNT(*) FILTER (WHERE stock_status = 'in_stock'),
        'out_of_stock', COUNT(*) FILTER (WHERE stock_status = 'out_of_stock'),
        'avg_price', COALESCE(ROUND(AVG(price)), 0),
        'total_stock_value', COALESCE(SUM(price * COALESCE(stock_qty, 0)), 0)
    ) INTO v_product_stats
    FROM products WHERE seller_id = v_seller.seller_id;

    -- Category distribution
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'category', category,
        'count', cnt
    )), '[]'::JSONB)
    INTO v_category_dist
    FROM (
        SELECT category, COUNT(*) as cnt
        FROM products WHERE seller_id = v_seller.seller_id
        GROUP BY category ORDER BY cnt DESC
    ) sub;

    -- Recent uploads
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', id,
        'file_name', file_name,
        'total_rows', total_rows,
        'success_count', success_count,
        'error_count', error_count,
        'status', status,
        'created_at', created_at
    ) ORDER BY created_at DESC), '[]'::JSONB)
    INTO v_recent_uploads
    FROM seller_uploads WHERE seller_id = v_seller.seller_id
    LIMIT 10;

    RETURN jsonb_build_object(
        'success', true,
        'seller', jsonb_build_object(
            'seller_id', v_seller.seller_id,
            'business_name', v_seller.business_name,
            'trust_score', v_seller.trust_score,
            'total_products', v_seller.total_products,
            'total_sales', v_seller.total_sales,
            'total_revenue', v_seller.total_revenue,
            'commission_rate', v_seller.commission_rate,
            'avg_ship_days', v_seller.avg_ship_days,
            'return_rate', v_seller.return_rate,
            'status', v_seller.status
        ),
        'products', v_product_stats,
        'categories', v_category_dist,
        'recent_uploads', v_recent_uploads
    );
END;
$$;

-- ━━━ 10. RPC: get_seller_products ━━━
CREATE OR REPLACE FUNCTION get_seller_products(
    p_api_key   TEXT,
    p_category  TEXT DEFAULT NULL,
    p_search    TEXT DEFAULT NULL,
    p_limit     INT DEFAULT 50,
    p_offset    INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_seller RECORD;
    v_products JSONB;
    v_total INT;
BEGIN
    SELECT * INTO v_seller FROM sellers WHERE api_key = p_api_key AND status = 'ACTIVE';
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid API key or inactive seller');
    END IF;

    -- Count total
    SELECT COUNT(*) INTO v_total
    FROM products
    WHERE seller_id = v_seller.seller_id
      AND (p_category IS NULL OR category = p_category)
      AND (p_search IS NULL OR title ILIKE '%' || p_search || '%' OR sku ILIKE '%' || p_search || '%');

    -- Get products
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'sku', sku, 'title', title, 'category', category,
        'brand', brand, 'price', price, 'stock_status', stock_status,
        'stock_qty', stock_qty, 'ship_by_days', ship_by_days,
        'eta_days', eta_days, 'return_days', return_days,
        'return_fee', return_fee, 'ai_readiness_score', ai_readiness_score,
        'seller_trust', seller_trust, 'created_at', created_at, 'updated_at', updated_at
    ) ORDER BY created_at DESC), '[]'::JSONB)
    INTO v_products
    FROM (
        SELECT * FROM products
        WHERE seller_id = v_seller.seller_id
          AND (p_category IS NULL OR category = p_category)
          AND (p_search IS NULL OR title ILIKE '%' || p_search || '%' OR sku ILIKE '%' || p_search || '%')
        ORDER BY created_at DESC
        LIMIT p_limit OFFSET p_offset
    ) sub;

    RETURN jsonb_build_object(
        'success', true,
        'seller_id', v_seller.seller_id,
        'total', v_total,
        'products', v_products
    );
END;
$$;

-- ━━━ 11. Permissions ━━━
GRANT EXECUTE ON FUNCTION seller_register TO anon, authenticated;
GRANT EXECUTE ON FUNCTION seller_auth TO anon, authenticated;
GRANT EXECUTE ON FUNCTION seller_upload_products TO anon, authenticated;
GRANT EXECUTE ON FUNCTION seller_dashboard_stats TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_seller_products TO anon, authenticated;
