-- ============================================
-- Domeggook Integration: Products Schema Extension
-- Run this in Supabase SQL Editor
-- ============================================

-- Add source tracking columns to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
ALTER TABLE products ADD COLUMN IF NOT EXISTS source_id TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- Drop and re-add category constraint to support more categories
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_category_check;
ALTER TABLE products ADD CONSTRAINT products_category_check 
  CHECK (category IN (
    'CONSUMABLES', 'MRO', 'OFFICE', 'FOOD', 'HOUSEHOLD', 
    'FASHION', 'BEAUTY', 'DIGITAL', 'SPORTS', 'OTHER'
  ));

-- Add source constraint
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_source_check;
ALTER TABLE products ADD CONSTRAINT products_source_check 
  CHECK (source IN ('manual', 'domeggook'));

-- Index for efficient source lookups
CREATE INDEX IF NOT EXISTS idx_products_source ON products(source);
CREATE INDEX IF NOT EXISTS idx_products_source_id ON products(source_id);

-- Prevent duplicate domeggook imports
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_domeggook_unique 
  ON products(source, source_id) WHERE source = 'domeggook';
