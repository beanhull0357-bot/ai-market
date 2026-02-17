-- ============================================
-- JSONMART Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Products (상품팩)
CREATE TABLE products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sku TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('CONSUMABLES', 'MRO')),
  title TEXT NOT NULL,
  brand TEXT NOT NULL DEFAULT '',
  gtin TEXT,
  
  -- Offer
  price INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'KRW',
  stock_status TEXT NOT NULL DEFAULT 'unknown' CHECK (stock_status IN ('in_stock', 'out_of_stock', 'unknown')),
  stock_qty INTEGER,
  ship_by_days INTEGER NOT NULL DEFAULT 1,
  eta_days INTEGER NOT NULL DEFAULT 3,
  
  -- Policies
  return_days INTEGER NOT NULL DEFAULT 7,
  return_fee INTEGER NOT NULL DEFAULT 0,
  return_exceptions TEXT[] DEFAULT '{}',
  
  -- Quality
  ai_readiness_score INTEGER NOT NULL DEFAULT 0,
  seller_trust INTEGER NOT NULL DEFAULT 0,
  
  -- Extra
  attributes JSONB DEFAULT '{}',
  sourcing_type TEXT NOT NULL DEFAULT 'HUMAN' CHECK (sourcing_type IN ('HUMAN', 'AI')),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Agent Policies (위임 정책)
CREATE TABLE agent_policies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  policy_id TEXT UNIQUE NOT NULL,
  user_id UUID,
  max_budget INTEGER NOT NULL DEFAULT 50000,
  allowed_categories TEXT[] DEFAULT '{CONSUMABLES,MRO}',
  max_delivery_days INTEGER NOT NULL DEFAULT 5,
  min_seller_trust INTEGER NOT NULL DEFAULT 70,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Orders (주문)
CREATE TABLE orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'ORDER_CREATED' 
    CHECK (status IN ('ORDER_CREATED','PAYMENT_AUTHORIZED','PROCUREMENT_PENDING','PROCUREMENT_SENT','SHIPPED','DELIVERED','VOIDED')),
  
  -- Items (JSONB array)
  items JSONB NOT NULL DEFAULT '[]',
  
  -- Payment
  payment_status TEXT NOT NULL DEFAULT 'AUTHORIZED' CHECK (payment_status IN ('AUTHORIZED','CAPTURED','VOIDED')),
  authorized_amount INTEGER NOT NULL DEFAULT 0,
  capture_deadline TIMESTAMPTZ,
  
  -- Risk flags
  risk_stock TEXT DEFAULT 'GREEN' CHECK (risk_stock IN ('GREEN','YELLOW','RED')),
  risk_price TEXT DEFAULT 'GREEN' CHECK (risk_price IN ('GREEN','YELLOW','RED')),
  risk_policy TEXT DEFAULT 'GREEN' CHECK (risk_policy IN ('GREEN','YELLOW','RED')),
  risk_consent TEXT DEFAULT 'GREEN' CHECK (risk_consent IN ('GREEN','RED')),
  risk_time_left TEXT DEFAULT 'GREEN' CHECK (risk_time_left IN ('GREEN','YELLOW','RED')),
  
  -- Consent
  third_party_sharing BOOLEAN DEFAULT false,
  
  -- Receipt / Decision trace
  decision_trace JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Agent Reviews (AI 리뷰)
CREATE TABLE agent_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id TEXT UNIQUE NOT NULL,
  target_sku TEXT NOT NULL REFERENCES products(sku),
  reviewer_agent_id TEXT NOT NULL,
  
  -- Metrics
  fulfillment_delta REAL DEFAULT 0,
  spec_compliance REAL DEFAULT 1.0,
  api_latency_ms INTEGER DEFAULT 0,
  
  -- Structured log
  structured_log JSONB DEFAULT '[]',
  
  -- Verdict
  verdict TEXT NOT NULL DEFAULT 'ENDORSE' CHECK (verdict IN ('ENDORSE','WARN','BLOCKLIST')),
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- Indexes for performance
-- ============================================
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_reviews_sku ON agent_reviews(target_sku);

-- ============================================
-- Enable Row Level Security (public read for MVP)
-- ============================================
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_reviews ENABLE ROW LEVEL SECURITY;

-- Products: public read, authenticated write
CREATE POLICY "Public read products" ON products
  FOR SELECT USING (true);
CREATE POLICY "Authenticated manage products" ON products
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated update products" ON products
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated delete products" ON products
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- Agent Policies: public read, owner manages
CREATE POLICY "Public read agent_policies" ON agent_policies
  FOR SELECT USING (true);
CREATE POLICY "Users manage own policies" ON agent_policies
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users update own policies" ON agent_policies
  FOR UPDATE USING (user_id = auth.uid() OR auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users delete own policies" ON agent_policies
  FOR DELETE USING (user_id = auth.uid() OR auth.uid() IS NOT NULL);

-- Orders: authenticated only
CREATE POLICY "Authenticated read orders" ON orders
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated insert orders" ON orders
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated update orders" ON orders
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Reviews: public read, authenticated write
CREATE POLICY "Public read reviews" ON agent_reviews
  FOR SELECT USING (true);
CREATE POLICY "Authenticated insert reviews" ON agent_reviews
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================
-- Seed: Insert initial mock data
-- ============================================
INSERT INTO products (sku, category, title, brand, gtin, price, stock_status, stock_qty, ship_by_days, eta_days, return_days, return_fee, return_exceptions, ai_readiness_score, seller_trust, attributes, sourcing_type) VALUES
  ('TISSUE-70x20', 'CONSUMABLES', 'BrandA Unscented Wet Wipes 70sheets x 20packs', 'BrandA', '8801234567890', 18900, 'in_stock', 142, 1, 2, 7, 6000, ARRAY['opened'], 92, 95, '{"unitCount":20,"sheetCount":70,"gsm":60}', 'HUMAN'),
  ('PAPER-A4-80G', 'MRO', 'DoubleA A4 Copy Paper 80g 2500 sheets', 'DoubleA', NULL, 24500, 'in_stock', 50, 1, 3, 7, 5000, ARRAY['box_damaged'], 88, 90, '{"spec":"A4","weight":"80g"}', 'HUMAN'),
  ('TONER-HP-123', 'MRO', 'Compatible Toner for HP LaserJet Pro (Black)', 'CompToner', NULL, 32000, 'unknown', NULL, 2, 4, 0, 0, ARRAY['no_return'], 45, 60, '{"compatibleModels":["HP-M15w","HP-M28w"]}', 'AI');

INSERT INTO agent_reviews (review_id, target_sku, reviewer_agent_id, fulfillment_delta, spec_compliance, api_latency_ms, structured_log, verdict) VALUES
  ('REV-1001', 'TISSUE-70x20', 'PROCURE-BOT-v2.1', 0, 1.0, 120, '[{"event":"WEIGHT_CHECK","level":"INFO","details":"Measured 13.5kg. Matches spec (13.5kg ± 0.1)."},{"event":"ETA_CHECK","level":"INFO","details":"Arrived at T+48h. Exact match."}]', 'ENDORSE'),
  ('REV-1002', 'TISSUE-70x20', 'OFFICE-MGR-AI-09', 2, 0.99, 450, '[{"event":"PKG_SCAN","level":"INFO","details":"Barcode readable. Packaging intact."}]', 'ENDORSE'),
  ('REV-1003', 'TONER-HP-123', 'PRINT-FLEET-X', 24, 0.85, 2200, '[{"event":"CHIP_READ","level":"ERROR","details":"Toner chip handshake failed on HP M15w."},{"event":"ETA_CHECK","level":"WARN","details":"Delayed by 24h."}]', 'BLOCKLIST');
