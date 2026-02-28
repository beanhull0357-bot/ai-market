-- ============================================
-- Data Quality Improvements Migration
-- Run this in Supabase SQL Editor
-- ============================================

-- #4: Add description column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;

-- #6: Price history tracking table
CREATE TABLE IF NOT EXISTS product_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_sku TEXT NOT NULL,
  old_price INTEGER,
  new_price INTEGER,
  price_diff INTEGER GENERATED ALWAYS AS (new_price - old_price) STORED,
  changed_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_price_history_sku ON product_price_history(product_sku);
CREATE INDEX IF NOT EXISTS idx_price_history_changed_at ON product_price_history(changed_at DESC);

-- #8: Inventory sync function
-- Call via: SELECT sync_domeggook_stock();
-- Or schedule via pg_cron: SELECT cron.schedule('sync-stock', '0 */6 * * *', 'SELECT sync_domeggook_stock()');
CREATE OR REPLACE FUNCTION sync_domeggook_stock()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_product RECORD;
  v_response http_response;
  v_body JSONB;
  v_detail JSONB;
  v_new_price INTEGER;
  v_new_stock TEXT;
  v_new_status TEXT;
  v_updated INTEGER := 0;
  v_failed INTEGER := 0;
  v_price_changed INTEGER := 0;
  v_total INTEGER := 0;
BEGIN
  -- Loop through domeggook-sourced products
  FOR v_product IN
    SELECT sku, source_id, price, stock_status
    FROM products
    WHERE source = 'domeggook'
      AND source_id IS NOT NULL
    ORDER BY last_synced_at ASC NULLS FIRST
    LIMIT 100  -- Process in batches of 100
  LOOP
    v_total := v_total + 1;

    BEGIN
      -- Call Domeggook detail API
      SELECT * INTO v_response FROM http_get(
        'https://domeggook.com/ssl/api/?ver=4.5&mode=getItemView'
        || '&aid=59a4d8f9efc963d6446f86615902e416'
        || '&no=' || v_product.source_id
        || '&om=json'
      );

      IF v_response.status = 200 THEN
        v_body := v_response.content::JSONB;
        v_detail := v_body->'domeggook';

        -- Extract new stock info
        v_new_stock := v_detail->'qty'->>'inventory';
        v_new_status := CASE
          WHEN v_detail->'basis'->>'status' = '판매중' THEN 'in_stock'
          ELSE 'out_of_stock'
        END;

        -- Extract new price (도매가)
        v_new_price := (v_detail->'price'->>'dome')::INTEGER;

        -- Record price change if different (#6)
        IF v_new_price IS NOT NULL AND v_new_price != v_product.price THEN
          INSERT INTO product_price_history (product_sku, old_price, new_price)
          VALUES (v_product.sku, v_product.price, v_new_price);
          v_price_changed := v_price_changed + 1;
        END IF;

        -- Update product
        UPDATE products SET
          stock_qty = COALESCE(v_new_stock::INTEGER, stock_qty),
          stock_status = v_new_status,
          last_synced_at = now()
        WHERE sku = v_product.sku;

        v_updated := v_updated + 1;
      ELSE
        v_failed := v_failed + 1;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
    END;

    -- Rate limit: 500ms between calls (pg_sleep accepts seconds)
    PERFORM pg_sleep(0.5);
  END LOOP;

  RETURN jsonb_build_object(
    'total_processed', v_total,
    'updated', v_updated,
    'failed', v_failed,
    'price_changes', v_price_changed,
    'synced_at', now()::TEXT
  );
END;
$$;

-- Grant execute to authenticated users (admin only should call)
GRANT EXECUTE ON FUNCTION sync_domeggook_stock() TO authenticated;
