-- ============================================
-- Product Data Quality Validation
-- Run this in Supabase SQL Editor
-- ============================================

CREATE OR REPLACE FUNCTION validate_products()
RETURNS TABLE (
  product_sku TEXT,
  product_title TEXT,
  issue_level TEXT,    -- 'critical', 'warning', 'info'
  issue_field TEXT,
  issue_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Critical: Price is 0 or null
  RETURN QUERY
  SELECT p.sku, p.title, 'critical'::TEXT, 'price'::TEXT,
    'Price is 0 or missing'::TEXT
  FROM products p WHERE p.price IS NULL OR p.price = 0;

  -- Critical: Title empty or too short
  RETURN QUERY
  SELECT p.sku, p.title, 'critical'::TEXT, 'title'::TEXT,
    'Title is missing or too short (< 5 chars)'::TEXT
  FROM products p WHERE p.title IS NULL OR length(p.title) < 5;

  -- Warning: Category is OTHER (unmapped)
  RETURN QUERY
  SELECT p.sku, p.title, 'warning'::TEXT, 'category'::TEXT,
    ('Category is OTHER (unmapped): consider recategorizing')::TEXT
  FROM products p WHERE p.category = 'OTHER';

  -- Warning: Brand is empty
  RETURN QUERY
  SELECT p.sku, p.title, 'warning'::TEXT, 'brand'::TEXT,
    'Brand name is missing'::TEXT
  FROM products p WHERE p.brand IS NULL OR p.brand = '';

  -- Warning: Stock qty unknown
  RETURN QUERY
  SELECT p.sku, p.title, 'warning'::TEXT, 'stock_qty'::TEXT,
    'Stock quantity is unknown (NULL)'::TEXT
  FROM products p WHERE p.stock_qty IS NULL;

  -- Warning: Seller trust is 0
  RETURN QUERY
  SELECT p.sku, p.title, 'warning'::TEXT, 'seller_trust'::TEXT,
    'Seller trust score is 0%'::TEXT
  FROM products p WHERE p.seller_trust = 0;

  -- Info: No image
  RETURN QUERY
  SELECT p.sku, p.title, 'info'::TEXT, 'image_url'::TEXT,
    'Product has no image URL'::TEXT
  FROM products p WHERE p.image_url IS NULL OR p.image_url = '';

  -- Info: AI readiness is default (70)
  RETURN QUERY
  SELECT p.sku, p.title, 'info'::TEXT, 'ai_readiness_score'::TEXT,
    'AI readiness score is default value (70) — not evaluated'::TEXT
  FROM products p WHERE p.ai_readiness_score = 70;
END;
$$;

GRANT EXECUTE ON FUNCTION validate_products() TO authenticated;
