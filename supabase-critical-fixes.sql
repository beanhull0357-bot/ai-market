-- ============================================
-- JSONMART Critical Fixes — Launch Readiness
-- 🔧 Run this in Supabase SQL Editor
-- ============================================
-- Created: 2026-02-26
-- Purpose: Fix Critical issues C-2 and C-4 from launch analysis
-- C-1 (category constraint): Already resolved in supabase-category-system.sql ✅
-- C-2 (orders missing columns): Fixed below
-- C-4 (payment_status constraint): Fixed below
-- ============================================

BEGIN;

-- ============================================
-- C-2 FIX: Add missing columns to orders table
-- Edge Function (jsonmart-api) inserts these columns
-- but no migration SQL adds them
-- ============================================

-- Agent & product info (used by Edge Function create_order)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS agent_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS product_title TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS unit_price INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_price INTEGER DEFAULT 0;

-- Payment method (wallet vs payapp)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'PAYAPP';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_deadline TIMESTAMPTZ;

-- Source tracking (API, MCP, WEB, etc.)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'API';

-- Indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_orders_agent_id ON orders(agent_id);
CREATE INDEX IF NOT EXISTS idx_orders_sku ON orders(sku);
CREATE INDEX IF NOT EXISTS idx_orders_payment_method ON orders(payment_method);

-- ============================================
-- C-4 FIX: Update payment_status CHECK constraint
-- Original: ('AUTHORIZED','CAPTURED','VOIDED')
-- Edge Function also uses: 'PENDING', 'PAYMENT_REQUESTED', 'CONFIRMED'
-- supabase-payapp.sql only had a COMMENT, not actual constraint update
-- ============================================

-- Drop old constraint (if exists)
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;

-- Add expanded constraint
ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status IN (
    'AUTHORIZED',
    'PENDING',
    'PAYMENT_REQUESTED', 
    'CAPTURED',
    'CONFIRMED',
    'VOIDED',
    'REFUNDED'
  ));

-- Update default to PENDING (more accurate for new orders)
-- Keep the old default unchanged if orders flow starts without payment
COMMENT ON COLUMN orders.payment_status IS 
  'Payment status: PENDING → PAYMENT_REQUESTED → CAPTURED/CONFIRMED/VOIDED/REFUNDED';

-- ============================================
-- Also update status constraint to include CONFIRMED
-- (used when wallet payment auto-confirms)
-- ============================================

-- Drop old status constraint (keep flexible for future states)
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN (
    'ORDER_CREATED',
    'PAYMENT_AUTHORIZED',
    'CONFIRMED',
    'PROCUREMENT_PENDING',
    'PROCUREMENT_SENT',
    'SHIPPED',
    'DELIVERED',
    'VOIDED',
    'CANCELLED',
    'REFUNDED'
  ));

COMMIT;

-- ============================================
-- VERIFICATION: Run these to confirm
-- ============================================
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'orders'
-- ORDER BY ordinal_position;
--
-- Expected new columns: agent_id, sku, product_title, quantity, 
-- unit_price, total_price, payment_method, payment_deadline, source
