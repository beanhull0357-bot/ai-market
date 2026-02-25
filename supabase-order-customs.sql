-- ============================================
-- Order Customs ID Field for International Shipping
-- Run this in Supabase SQL Editor
-- ============================================

-- Add customs clearance ID for international direct shipping orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customs_id TEXT;

-- Comment for clarity
COMMENT ON COLUMN orders.customs_id IS '통관고유번호 - 해외직배송 상품 구매 시 배송받는 구매자의 통관고유번호';
