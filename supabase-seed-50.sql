-- ============================================
-- JSONMART: 50 Product Packs (도매 기준 B2B)
-- Run AFTER supabase-schema.sql
-- Uses ON CONFLICT to safely upsert
-- ============================================

-- Delete existing seed data to avoid duplicates
DELETE FROM agent_reviews WHERE review_id IN ('REV-1001','REV-1002','REV-1003');
DELETE FROM products WHERE sku IN ('TISSUE-70x20','PAPER-A4-80G','TONER-HP-123');

-- ============================================
-- CONSUMABLES (25 items)
-- ============================================
INSERT INTO products (sku, category, title, brand, gtin, price, stock_status, stock_qty, ship_by_days, eta_days, return_days, return_fee, return_exceptions, ai_readiness_score, seller_trust, attributes, sourcing_type) VALUES

-- Wet Wipes & Tissue
('TISSUE-70x20', 'CONSUMABLES', 'BrandA Unscented Wet Wipes 70sheets x 20packs', 'BrandA', '8801234567890', 18900, 'in_stock', 142, 1, 2, 7, 6000, ARRAY['opened'], 92, 95, '{"unitCount":20,"sheetCount":70,"gsm":60}', 'HUMAN'),
('TISSUE-DRY-200', 'CONSUMABLES', 'SoftClean Dry Tissue 200sheets x 12box', 'SoftClean', '8801234567891', 15800, 'in_stock', 230, 1, 2, 7, 4000, ARRAY['opened'], 90, 93, '{"unitCount":12,"sheetCount":200,"ply":2}', 'HUMAN'),
('TISSUE-ROLL-30', 'CONSUMABLES', 'WhiteSoft Toilet Roll 30m x 30rolls', 'WhiteSoft', '8801234567892', 22500, 'in_stock', 85, 1, 2, 7, 5000, ARRAY['opened'], 88, 92, '{"unitCount":30,"length_m":30,"ply":3}', 'HUMAN'),
('TISSUE-KITCHEN-150', 'CONSUMABLES', 'CleanMax Kitchen Towel 150sheets x 6rolls', 'CleanMax', '8801234567893', 9800, 'in_stock', 310, 1, 2, 7, 3000, ARRAY['opened'], 85, 90, '{"unitCount":6,"sheetCount":150,"absorbency":"high"}', 'HUMAN'),

-- Hand Soap & Sanitizer
('SOAP-HAND-500', 'CONSUMABLES', 'CleanHands Foam Hand Soap 500ml x 12ea', 'CleanHands', '8802345678901', 28500, 'in_stock', 95, 1, 2, 14, 5000, ARRAY['opened'], 91, 94, '{"unitCount":12,"volume_ml":500,"type":"foam"}', 'HUMAN'),
('SANITIZER-500', 'CONSUMABLES', 'PureGuard Hand Sanitizer 500ml x 10ea', 'PureGuard', '8802345678902', 32000, 'in_stock', 60, 1, 2, 14, 5000, ARRAY['opened'], 89, 91, '{"unitCount":10,"volume_ml":500,"alcoholPercent":62}', 'HUMAN'),
('SOAP-DISH-1L', 'CONSUMABLES', 'SparkClean Dish Soap 1L x 12ea', 'SparkClean', '8802345678903', 18000, 'in_stock', 180, 1, 2, 14, 4000, ARRAY['opened'], 87, 89, '{"unitCount":12,"volume_ml":1000,"scent":"lemon"}', 'HUMAN'),

-- Trash Bags
('TRASH-20L-100', 'CONSUMABLES', 'StrongBag Trash Bags 20L x 100ea', 'StrongBag', '8803456789012', 8900, 'in_stock', 420, 1, 2, 7, 3000, ARRAY['opened'], 93, 96, '{"unitCount":100,"volume_L":20,"thickness_um":18}', 'HUMAN'),
('TRASH-50L-50', 'CONSUMABLES', 'StrongBag Trash Bags 50L x 50ea', 'StrongBag', '8803456789013', 11500, 'in_stock', 280, 1, 2, 7, 3000, ARRAY['opened'], 93, 96, '{"unitCount":50,"volume_L":50,"thickness_um":22}', 'HUMAN'),
('TRASH-100L-30', 'CONSUMABLES', 'StrongBag Trash Bags 100L x 30ea', 'StrongBag', '8803456789014', 12800, 'in_stock', 150, 1, 2, 7, 3000, ARRAY['opened'], 92, 95, '{"unitCount":30,"volume_L":100,"thickness_um":25}', 'HUMAN'),

-- Cleaning Supplies
('CLEANER-MULTI-1L', 'CONSUMABLES', 'AllPure Multi-Surface Cleaner 1L x 6ea', 'AllPure', '8804567890123', 15600, 'in_stock', 200, 1, 3, 14, 4000, ARRAY['opened'], 86, 88, '{"unitCount":6,"volume_ml":1000,"type":"spray"}', 'HUMAN'),
('CLEANER-GLASS-500', 'CONSUMABLES', 'CrystalView Glass Cleaner 500ml x 12ea', 'CrystalView', '8804567890124', 19800, 'in_stock', 110, 1, 3, 14, 4000, ARRAY['opened'], 84, 87, '{"unitCount":12,"volume_ml":500}', 'HUMAN'),
('MOP-WET-REFILL', 'CONSUMABLES', 'EasyMop Wet Refill Pads 30sheets x 4box', 'EasyMop', '8804567890125', 16400, 'in_stock', 160, 1, 3, 14, 3000, ARRAY['opened'], 82, 85, '{"unitCount":4,"sheetCount":30,"size":"280x200mm"}', 'HUMAN'),

-- Beverage (Office)
('COFFEE-MIX-100', 'CONSUMABLES', 'Maxim Mocha Gold Mix 12g x 100sticks', 'Maxim', '8805678901234', 18500, 'in_stock', 500, 1, 2, 30, 0, ARRAY['opened'], 95, 97, '{"unitCount":100,"weight_g":12,"type":"3-in-1"}', 'HUMAN'),
('WATER-500-40', 'CONSUMABLES', 'Jeju SamDaSoo Water 500ml x 40ea', 'SamDaSoo', '8805678901235', 14200, 'in_stock', 800, 1, 2, 7, 5000, ARRAY['opened'], 94, 96, '{"unitCount":40,"volume_ml":500,"source":"Jeju"}', 'HUMAN'),
('TEA-GREEN-100', 'CONSUMABLES', 'DongSuh Green Tea 1.5g x 100bags', 'DongSuh', '8805678901236', 12300, 'in_stock', 350, 1, 2, 30, 0, ARRAY['opened'], 91, 93, '{"unitCount":100,"weight_g":1.5,"type":"bag"}', 'HUMAN'),
('SUGAR-STICK-100', 'CONSUMABLES', 'CJ White Sugar Stick 5g x 100ea', 'CJ', '8805678901237', 5800, 'in_stock', 600, 1, 2, 30, 0, ARRAY['opened'], 90, 92, '{"unitCount":100,"weight_g":5}', 'HUMAN'),
('CREAMER-STICK-100', 'CONSUMABLES', 'Premia Coffee Creamer 5g x 100ea', 'Premia', '8805678901238', 6200, 'in_stock', 450, 1, 2, 30, 0, ARRAY['opened'], 89, 91, '{"unitCount":100,"weight_g":5}', 'HUMAN'),

-- Disposables (Office/Event)
('CUP-PAPER-1000', 'CONSUMABLES', 'EcoCup Paper Cup 180ml x 1000ea', 'EcoCup', '8806789012345', 22000, 'in_stock', 90, 1, 3, 7, 5000, ARRAY['opened'], 88, 90, '{"unitCount":1000,"volume_ml":180,"material":"paper"}', 'HUMAN'),
('GLOVE-VINYL-100', 'CONSUMABLES', 'SafeTouch Vinyl Gloves M x 100ea', 'SafeTouch', '8806789012346', 7500, 'in_stock', 250, 1, 2, 7, 3000, ARRAY['opened'], 87, 89, '{"unitCount":100,"size":"M","material":"vinyl","powder_free":true}', 'HUMAN'),
('MASK-KF94-50', 'CONSUMABLES', 'CleanBreeze KF94 Mask x 50ea', 'CleanBreeze', '8806789012347', 35000, 'in_stock', 120, 1, 2, 7, 0, ARRAY['opened','hygiene'], 86, 88, '{"unitCount":50,"rating":"KF94","type":"3D"}', 'HUMAN'),

-- Stationery Consumables
('PEN-BALLPOINT-50', 'CONSUMABLES', 'MonAmi 153 Ballpoint Pen Black x 50ea', 'MonAmi', '8807890123456', 15000, 'in_stock', 180, 1, 2, 14, 0, ARRAY['opened'], 85, 90, '{"unitCount":50,"color":"black","tip_mm":0.7}', 'HUMAN'),
('MARKER-BOARD-12', 'CONSUMABLES', 'MonAmi Whiteboard Marker 4-color x 12set', 'MonAmi', '8807890123457', 24000, 'in_stock', 95, 1, 3, 14, 3000, ARRAY['opened'], 83, 88, '{"unitCount":12,"colors":["black","red","blue","green"]}', 'HUMAN'),
('STICKY-NOTE-12', 'CONSUMABLES', 'PostMemo Sticky Notes 76x76mm x 12pads', 'PostMemo', '8807890123458', 8500, 'in_stock', 320, 1, 2, 14, 0, ARRAY['opened'], 84, 87, '{"unitCount":12,"size":"76x76mm","sheets_per_pad":100}', 'HUMAN'),
('ERASER-30', 'CONSUMABLES', 'CleanErase Eraser x 30ea', 'CleanErase', '8807890123459', 9000, 'in_stock', 200, 1, 2, 14, 0, ARRAY['opened'], 80, 85, '{"unitCount":30}', 'HUMAN')

ON CONFLICT (sku) DO UPDATE SET
  title = EXCLUDED.title,
  brand = EXCLUDED.brand,
  price = EXCLUDED.price,
  stock_status = EXCLUDED.stock_status,
  stock_qty = EXCLUDED.stock_qty,
  ai_readiness_score = EXCLUDED.ai_readiness_score,
  seller_trust = EXCLUDED.seller_trust,
  attributes = EXCLUDED.attributes,
  updated_at = now();

-- ============================================
-- MRO (25 items)
-- ============================================
INSERT INTO products (sku, category, title, brand, gtin, price, stock_status, stock_qty, ship_by_days, eta_days, return_days, return_fee, return_exceptions, ai_readiness_score, seller_trust, attributes, sourcing_type) VALUES

-- Paper & Printing
('PAPER-A4-80G', 'MRO', 'DoubleA A4 Copy Paper 80g 2500 sheets', 'DoubleA', '8808901234567', 24500, 'in_stock', 50, 1, 3, 7, 5000, ARRAY['box_damaged'], 88, 90, '{"spec":"A4","weight":"80g","sheets":2500}', 'HUMAN'),
('PAPER-A3-80G', 'MRO', 'DoubleA A3 Copy Paper 80g 1250 sheets', 'DoubleA', '8808901234568', 28000, 'in_stock', 30, 1, 3, 7, 5000, ARRAY['box_damaged'], 86, 90, '{"spec":"A3","weight":"80g","sheets":1250}', 'HUMAN'),
('PAPER-THERMAL-50', 'MRO', 'Thermal Receipt Paper 80x80mm x 50rolls', 'ThermalPro', '8808901234569', 35000, 'in_stock', 40, 1, 3, 7, 5000, ARRAY['opened'], 84, 88, '{"unitCount":50,"size":"80x80mm","core":"12mm"}', 'HUMAN'),

-- Toner & Ink
('TONER-HP-123', 'MRO', 'Compatible Toner for HP LaserJet Pro (Black)', 'CompToner', '8809012345678', 32000, 'unknown', NULL, 2, 4, 0, 0, ARRAY['no_return'], 45, 60, '{"compatibleModels":["HP-M15w","HP-M28w"],"yield":1500}', 'AI'),
('TONER-SAM-111', 'MRO', 'Samsung MLT-D111S Compatible Toner (Black)', 'CompToner', '8809012345679', 28000, 'in_stock', 25, 2, 4, 14, 5000, ARRAY['opened'], 72, 75, '{"compatibleModels":["Samsung-M2020","M2070"],"yield":1000}', 'AI'),
('INK-EP-664-4C', 'MRO', 'Epson T664 Compatible Ink Set (CMYK)', 'InkMax', '8809012345680', 18000, 'in_stock', 60, 1, 3, 14, 4000, ARRAY['opened'], 68, 70, '{"colors":["C","M","Y","K"],"volume_ml":70,"compatibleModels":["L110","L210","L355"]}', 'AI'),

-- Labels & Tape
('LABEL-A4-21', 'MRO', 'FormTec Address Label A4 21-up x 100sheets', 'FormTec', '8810123456789', 15000, 'in_stock', 110, 1, 3, 14, 3000, ARRAY['opened'], 82, 86, '{"unitCount":100,"labels_per_sheet":21,"size":"63.5x38.1mm"}', 'HUMAN'),
('TAPE-OPP-48', 'MRO', 'PackRight OPP Tape 48mm x 100m x 50rolls', 'PackRight', '8810123456790', 42000, 'in_stock', 45, 1, 3, 7, 5000, ARRAY['opened'], 90, 93, '{"unitCount":50,"width_mm":48,"length_m":100}', 'HUMAN'),
('TAPE-MASKING-24', 'MRO', 'PaintPro Masking Tape 24mm x 18m x 30rolls', 'PaintPro', '8810123456791', 18500, 'in_stock', 80, 1, 3, 7, 4000, ARRAY['opened'], 85, 88, '{"unitCount":30,"width_mm":24,"length_m":18}', 'HUMAN'),

-- Filing & Storage
('FOLDER-CLEAR-100', 'MRO', 'OfficePro Clear Folder A4 x 100ea', 'OfficePro', '8811234567890', 22000, 'in_stock', 70, 1, 3, 14, 3000, ARRAY['damaged'], 81, 85, '{"unitCount":100,"spec":"A4","thickness_um":120}', 'HUMAN'),
('BINDER-3R-10', 'MRO', 'OfficePro 3-Ring Binder A4 x 10ea', 'OfficePro', '8811234567891', 28000, 'in_stock', 35, 1, 3, 14, 4000, ARRAY['damaged'], 79, 83, '{"unitCount":10,"spec":"A4","rings":3,"spine_mm":50}', 'HUMAN'),
('BOX-ARCHIVE-20', 'MRO', 'ArchiveBox Document Storage Box x 20ea', 'ArchiveBox', '8811234567892', 32000, 'in_stock', 28, 1, 4, 7, 5000, ARRAY['damaged'], 77, 82, '{"unitCount":20,"size":"350x250x300mm","loadCapacity_kg":15}', 'HUMAN'),

-- IT Accessories
('USB-C-CABLE-10', 'MRO', 'ChargePro USB-C Cable 1m x 10ea', 'ChargePro', '8812345678901', 25000, 'in_stock', 55, 1, 3, 30, 0, ARRAY['no_return_if_opened'], 75, 80, '{"unitCount":10,"length_m":1,"type":"USB-C to USB-C","spec":"USB3.1"}', 'HUMAN'),
('MOUSE-WIRELESS-5', 'MRO', 'LogiTech M185 Wireless Mouse x 5ea', 'Logitech', '8812345678902', 45000, 'in_stock', 20, 1, 3, 30, 0, ARRAY['defective_only'], 73, 78, '{"unitCount":5,"connectivity":"2.4GHz","battery":"AA x1"}', 'HUMAN'),
('KEYBOARD-USB-5', 'MRO', 'SamTech USB Keyboard Korean x 5ea', 'SamTech', '8812345678903', 35000, 'in_stock', 15, 2, 4, 30, 0, ARRAY['defective_only'], 71, 76, '{"unitCount":5,"connectivity":"USB","layout":"Korean"}', 'HUMAN'),
('HDMI-CABLE-5', 'MRO', 'ViewLink HDMI 2.0 Cable 2m x 5ea', 'ViewLink', '8812345678904', 18000, 'in_stock', 40, 1, 3, 30, 0, ARRAY['defective_only'], 74, 79, '{"unitCount":5,"length_m":2,"spec":"HDMI 2.0","support":"4K@60Hz"}', 'HUMAN'),

-- Safety & Facility
('LIGHT-LED-10', 'MRO', 'BrightLux LED Panel Light 40W x 10ea', 'BrightLux', '8813456789012', 120000, 'in_stock', 12, 2, 5, 14, 10000, ARRAY['installed'], 70, 75, '{"unitCount":10,"watt":40,"lumen":4000,"colorTemp_K":5000,"size":"600x600mm"}', 'HUMAN'),
('BATTERY-AA-48', 'MRO', 'PowerMax Alkaline Battery AA x 48ea', 'PowerMax', '8813456789013', 16000, 'in_stock', 200, 1, 2, 14, 3000, ARRAY['opened'], 92, 94, '{"unitCount":48,"type":"AA","chemistry":"alkaline","voltage":1.5}', 'HUMAN'),
('BATTERY-AAA-48', 'MRO', 'PowerMax Alkaline Battery AAA x 48ea', 'PowerMax', '8813456789014', 16000, 'in_stock', 180, 1, 2, 14, 3000, ARRAY['opened'], 92, 94, '{"unitCount":48,"type":"AAA","chemistry":"alkaline","voltage":1.5}', 'HUMAN'),
('EXTCORD-3M-5', 'MRO', 'SafeWire Extension Cord 3m 4-outlet x 5ea', 'SafeWire', '8813456789015', 42000, 'in_stock', 25, 1, 3, 30, 5000, ARRAY['damaged'], 78, 82, '{"unitCount":5,"length_m":3,"outlets":4,"overloadProtection":true}', 'HUMAN'),

-- Furniture Consumable (Chair parts, etc.)
('WHEEL-CHAIR-20', 'MRO', 'RollEasy Office Chair Caster Wheel x 20set', 'RollEasy', '8814567890123', 38000, 'in_stock', 30, 2, 5, 30, 5000, ARRAY['installed'], 65, 72, '{"unitCount":20,"wheels_per_set":5,"diameter_mm":60,"silent":true}', 'HUMAN'),

-- Janitorial
('BROOM-COMBO-5', 'MRO', 'CleanPro Broom & Dustpan Combo x 5set', 'CleanPro', '8815678901234', 25000, 'in_stock', 40, 1, 4, 14, 4000, ARRAY['damaged'], 76, 80, '{"unitCount":5,"broom_width_mm":300}', 'HUMAN'),
('BUCKET-10L-5', 'MRO', 'CleanPro Mop Bucket with Wringer 10L x 5ea', 'CleanPro', '8815678901235', 35000, 'in_stock', 20, 2, 5, 14, 5000, ARRAY['damaged'], 74, 78, '{"unitCount":5,"volume_L":10,"wringer":"squeeze"}', 'HUMAN'),
('FIRST-AID-KIT', 'MRO', 'SafeFirst First Aid Kit (50 person)', 'SafeFirst', '8815678901236', 28000, 'in_stock', 35, 1, 3, 30, 0, ARRAY['opened'], 80, 86, '{"capacity":"50_person","items":32,"expiry_months":36}', 'HUMAN'),
('FIRE-EXT-3KG', 'MRO', 'FireStop ABC Dry Chemical Extinguisher 3.3kg', 'FireStop', '8815678901237', 25000, 'in_stock', 18, 2, 5, 30, 5000, ARRAY['used'], 83, 87, '{"weight_kg":3.3,"type":"ABC","rating":"3A-10B","refillable":true}', 'HUMAN')

ON CONFLICT (sku) DO UPDATE SET
  title = EXCLUDED.title,
  brand = EXCLUDED.brand,
  price = EXCLUDED.price,
  stock_status = EXCLUDED.stock_status,
  stock_qty = EXCLUDED.stock_qty,
  ai_readiness_score = EXCLUDED.ai_readiness_score,
  seller_trust = EXCLUDED.seller_trust,
  attributes = EXCLUDED.attributes,
  updated_at = now();

-- ============================================
-- Seed Reviews for new products
-- ============================================
INSERT INTO agent_reviews (review_id, target_sku, reviewer_agent_id, fulfillment_delta, spec_compliance, api_latency_ms, structured_log, verdict) VALUES
  -- Original reviews
  ('REV-1001', 'TISSUE-70x20', 'PROCURE-BOT-v2.1', 0, 1.0, 120, '[{"event":"WEIGHT_CHECK","level":"INFO","details":"Measured 13.5kg. Matches spec (13.5kg ± 0.1)."},{"event":"ETA_CHECK","level":"INFO","details":"Arrived at T+48h. Exact match."}]', 'ENDORSE'),
  ('REV-1002', 'TISSUE-70x20', 'OFFICE-MGR-AI-09', 2, 0.99, 450, '[{"event":"PKG_SCAN","level":"INFO","details":"Barcode readable. Packaging intact."}]', 'ENDORSE'),
  ('REV-1003', 'TONER-HP-123', 'PRINT-FLEET-X', 24, 0.85, 2200, '[{"event":"CHIP_READ","level":"ERROR","details":"Toner chip handshake failed on HP M15w."},{"event":"ETA_CHECK","level":"WARN","details":"Delayed by 24h."}]', 'BLOCKLIST'),
  -- New reviews
  ('REV-2001', 'COFFEE-MIX-100', 'OFFICE-MGR-AI-09', 0, 1.0, 180, '[{"event":"WEIGHT_CHECK","level":"INFO","details":"100 sticks counted and verified."},{"event":"EXPIRY_CHECK","level":"INFO","details":"Best before 2027-06."}]', 'ENDORSE'),
  ('REV-2002', 'WATER-500-40', 'PROCURE-BOT-v2.1', 0, 1.0, 95, '[{"event":"QTY_CHECK","level":"INFO","details":"40 bottles confirmed."},{"event":"ETA_CHECK","level":"INFO","details":"Same-day delivery."}]', 'ENDORSE'),
  ('REV-2003', 'TRASH-20L-100', 'FACILITY-BOT-K1', 0, 1.0, 110, '[{"event":"SPEC_CHECK","level":"INFO","details":"Thickness 18μm confirmed. No tears."}]', 'ENDORSE'),
  ('REV-2004', 'PAPER-A4-80G', 'PRINT-FLEET-X', 1, 0.98, 320, '[{"event":"WEIGHT_CHECK","level":"INFO","details":"2500 sheets, 80gsm confirmed."},{"event":"JAM_TEST","level":"INFO","details":"No jams in 500-sheet test run on HP M15w."}]', 'ENDORSE'),
  ('REV-2005', 'PAPER-A4-80G', 'OFFICE-MGR-AI-09', 0, 1.0, 200, '[{"event":"PKG_SCAN","level":"INFO","details":"5 reams sealed. Box intact."}]', 'ENDORSE'),
  ('REV-2006', 'SOAP-HAND-500', 'FACILITY-BOT-K1', 0, 1.0, 150, '[{"event":"VOLUME_CHECK","level":"INFO","details":"12 bottles x 500ml verified."}]', 'ENDORSE'),
  ('REV-2007', 'BATTERY-AA-48', 'PROCURE-BOT-v2.1', 0, 1.0, 88, '[{"event":"VOLTAGE_CHECK","level":"INFO","details":"All 48 cells at 1.55V+. Fresh batch."}]', 'ENDORSE'),
  ('REV-2008', 'INK-EP-664-4C', 'PRINT-FLEET-X', 8, 0.90, 1800, '[{"event":"COLOR_CHECK","level":"WARN","details":"Cyan slightly lighter than OEM reference."},{"event":"ETA_CHECK","level":"WARN","details":"Delayed by 8h."}]', 'WARN'),
  ('REV-2009', 'TONER-SAM-111', 'PRINT-FLEET-X', 4, 0.92, 950, '[{"event":"YIELD_CHECK","level":"INFO","details":"Estimated ~950 pages (spec: 1000). Acceptable variance."},{"event":"CHIP_READ","level":"INFO","details":"Toner chip recognized."}]', 'ENDORSE'),
  ('REV-2010', 'MASK-KF94-50', 'FACILITY-BOT-K1', 0, 1.0, 130, '[{"event":"CERT_CHECK","level":"INFO","details":"KF94 certification label verified. Lot# BZ-2025-R2."}]', 'ENDORSE'),
  ('REV-2011', 'TAPE-OPP-48', 'FACILITY-BOT-K1', 0, 1.0, 105, '[{"event":"SPEC_CHECK","level":"INFO","details":"50 rolls, 48mm x 100m confirmed. Good adhesion."}]', 'ENDORSE'),
  ('REV-2012', 'PEN-BALLPOINT-50', 'OFFICE-MGR-AI-09', 2, 0.96, 210, '[{"event":"QTY_CHECK","level":"INFO","details":"50 pens counted."},{"event":"WRITE_TEST","level":"WARN","details":"2 pens had delayed ink flow on first use."}]', 'ENDORSE'),
  ('REV-2013', 'LIGHT-LED-10', 'FACILITY-BOT-K1', 12, 0.95, 1500, '[{"event":"LUMEN_CHECK","level":"INFO","details":"Measured 3850 lumen (spec: 4000). Within 5% tolerance."},{"event":"INSTALL_CHECK","level":"WARN","details":"1 unit had loose mounting clip."}]', 'WARN'),
  ('REV-2014', 'MOUSE-WIRELESS-5', 'IT-ASSET-BOT-07', 0, 1.0, 300, '[{"event":"PAIR_TEST","level":"INFO","details":"All 5 mice paired on first attempt."},{"event":"BATTERY_CHECK","level":"INFO","details":"AA batteries included, 1.58V."}]', 'ENDORSE'),
  ('REV-2015', 'FIRE-EXT-3KG', 'FACILITY-BOT-K1', 0, 1.0, 180, '[{"event":"CERT_CHECK","level":"INFO","details":"KFI certified. Manufacturing date 2025-01."},{"event":"PRESSURE_CHECK","level":"INFO","details":"Gauge in green zone."}]', 'ENDORSE')
ON CONFLICT (review_id) DO NOTHING;

-- ============================================
-- Seed: Agent Offers (Promotions for Agents)
-- Must run AFTER products are inserted
-- ============================================
INSERT INTO agent_offers (offer_id, sku, category, discount_type, discount_value, min_qty, max_per_order, max_per_month, min_order_amount, valid_from, valid_to, stackable, explain, status) VALUES
('OFR-2026-001', 'COFFEE-MIX-100', NULL, 'percent_discount', 5, 1, 50000, 200000, 0, '2026-02-14T00:00:00+09:00', '2026-03-14T23:59:59+09:00', false, '커피 정기 구매 할인 — 월 20만원 한도 내 5% 할인', 'ACTIVE'),
('OFR-2026-002', 'WATER-500-40', NULL, 'percent_discount', 3, 2, 60000, 300000, 28400, '2026-02-14T00:00:00+09:00', '2026-02-28T23:59:59+09:00', false, '생수 2박스 이상 주문 시 3% 할인 (최소 28,400원)', 'ACTIVE'),
('OFR-2026-003', NULL, 'CONSUMABLES', 'percent_discount', 2, 1, 100000, 500000, 50000, '2026-02-14T00:00:00+09:00', '2026-03-31T23:59:59+09:00', false, '소모품 카테고리 전체 2% 할인 — 5만원 이상 주문 시', 'ACTIVE'),
('OFR-2026-004', 'PAPER-A4-80G', NULL, 'fixed_discount', 2000, 1, NULL, NULL, 0, '2026-02-14T00:00:00+09:00', '2026-02-21T23:59:59+09:00', true, 'A4 용지 2,000원 즉시 할인 (다른 오퍼와 중복 적용 가능)', 'ACTIVE'),
('OFR-2026-005', 'TRASH-20L-100', NULL, 'bundle_deal', 10, 3, NULL, NULL, 0, '2026-02-14T00:00:00+09:00', '2026-03-14T23:59:59+09:00', false, '쓰레기봉투 3팩 동시 주문 시 10% 번들 할인', 'ACTIVE'),
('OFR-2026-006', 'BATTERY-AA-48', NULL, 'percent_discount', 7, 1, NULL, 100000, 0, '2026-02-14T00:00:00+09:00', '2026-02-28T23:59:59+09:00', false, 'AA 배터리 7% 재고 정리 할인 — 월 10만원 한도', 'ACTIVE')
ON CONFLICT (offer_id) DO NOTHING;
