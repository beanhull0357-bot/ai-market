-- PayApp PG Integration: Add payment tracking columns to orders table
-- Run this migration on Supabase SQL Editor

-- Add PayApp-specific columns to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payapp_mul_no TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payapp_payurl TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payapp_pay_type TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payapp_pay_date TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payapp_recvphone TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Index for fast callback lookup
CREATE INDEX IF NOT EXISTS idx_orders_payapp_mul_no ON orders(payapp_mul_no);

-- Update payment_status to support new states
-- Existing values: AUTHORIZED, CAPTURED, VOIDED
-- New values: PAYMENT_REQUESTED, CAPTURED, VOIDED, REFUNDED
COMMENT ON COLUMN orders.payment_status IS 'Payment status: AUTHORIZED, PAYMENT_REQUESTED, CAPTURED, VOIDED, REFUNDED';
