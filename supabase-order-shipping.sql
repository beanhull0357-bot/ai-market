-- ============================================
-- Order Shipping Fields for Domeggook Export
-- Run this in Supabase SQL Editor
-- ============================================

-- Add shipping/recipient columns to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS recipient_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS postal_code TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS address_detail TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS phone_alt TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_note TEXT;

-- Track procurement status for Domeggook export workflow
ALTER TABLE orders ADD COLUMN IF NOT EXISTS procurement_status TEXT 
  DEFAULT 'pending' CHECK (procurement_status IN ('pending', 'exported', 'ordered', 'shipped'));

-- Index for quick filtering of pending procurement
CREATE INDEX IF NOT EXISTS idx_orders_procurement ON orders(procurement_status);
