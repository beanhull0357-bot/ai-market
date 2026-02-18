-- ============================================
-- JSONMART: Extended Product Catalog
-- Run in Supabase SQL Editor
-- Adds categories + ~100 new products
-- ============================================

-- ━━━ 1. Expand category constraint ━━━
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_category_check;
ALTER TABLE products ADD CONSTRAINT products_category_check 
  CHECK (category IN ('CONSUMABLES', 'MRO', 'OFFICE', 'IT_EQUIPMENT', 'KITCHEN', 'SAFETY', 'HYGIENE'));

-- ━━━ 2. OFFICE (사무용품) — 15 items ━━━
INSERT INTO products (sku, category, title, brand, gtin, price, stock_status, stock_qty, ship_by_days, eta_days, return_days, return_fee, return_exceptions, ai_readiness_score, seller_trust, attributes, sourcing_type) VALUES

-- 노트 & 수첩
('NOTE-A5-RULED-10', 'OFFICE', 'Oxford A5 Ruled Notebook 80p x 10ea', 'Oxford', '8820000000001', 18000, 'in_stock', 200, 1, 2, 14, 0, ARRAY['opened'], 88, 90, '{"unitCount":10,"pages":80,"size":"A5","ruling":"7mm"}', 'HUMAN'),
('NOTE-SPRING-B5-5', 'OFFICE', 'Kokuyo Campus Spring Notebook B5 x 5ea', 'Kokuyo', '8820000000002', 12500, 'in_stock', 150, 1, 2, 14, 0, ARRAY['opened'], 86, 89, '{"unitCount":5,"pages":100,"size":"B5","binding":"spring"}', 'HUMAN'),
('PLANNER-2026', 'OFFICE', 'Moleskine Weekly Planner 2026 Large', 'Moleskine', '8820000000003', 32000, 'in_stock', 45, 1, 3, 30, 0, ARRAY['opened'], 82, 87, '{"year":2026,"size":"large","type":"weekly","hardcover":true}', 'HUMAN'),

-- 사무용 클립 & 핀
('CLIP-BINDER-200', 'OFFICE', 'PLUS Binder Clip Assorted x 200ea', 'PLUS', '8820000000004', 8500, 'in_stock', 350, 1, 2, 7, 0, ARRAY['opened'], 90, 92, '{"unitCount":200,"sizes":["S","M","L"],"material":"steel"}', 'HUMAN'),
('PIN-PUSH-500', 'OFFICE', 'Penco Push Pins Color Mix x 500ea', 'Penco', '8820000000005', 6500, 'in_stock', 400, 1, 2, 7, 0, ARRAY['opened'], 88, 90, '{"unitCount":500,"colors":["red","blue","green","yellow","white"]}', 'HUMAN'),
('STAPLER-HD-3', 'OFFICE', 'Max HD-50 Heavy Duty Stapler x 3ea', 'Max', '8820000000006', 27000, 'in_stock', 80, 1, 3, 30, 3000, ARRAY['defective_only'], 84, 88, '{"unitCount":3,"capacity_sheets":30,"staple_size":"No.10"}', 'HUMAN'),
('STAPLE-REFILL-10', 'OFFICE', 'Max No.10 Staple Refill 1000p x 10box', 'Max', '8820000000007', 5500, 'in_stock', 500, 1, 2, 7, 0, ARRAY['opened'], 92, 94, '{"unitCount":10,"staples_per_box":1000,"size":"No.10"}', 'HUMAN'),

-- 화이트보드 & 프레젠테이션
('BOARD-WHITE-900', 'OFFICE', 'Quartet Magnetic Whiteboard 900x600mm', 'Quartet', '8820000000008', 45000, 'in_stock', 20, 2, 4, 14, 5000, ARRAY['damaged'], 78, 82, '{"size":"900x600mm","magnetic":true,"frame":"aluminum"}', 'HUMAN'),
('BOARD-ERASER-5', 'OFFICE', 'Pilot Whiteboard Eraser x 5ea', 'Pilot', '8820000000009', 12000, 'in_stock', 120, 1, 2, 14, 0, ARRAY['opened'], 85, 88, '{"unitCount":5,"type":"magnetic","size":"120x55mm"}', 'HUMAN'),

-- 계산기 & 문구
('CALC-DESK-3', 'OFFICE', 'Casio MX-12B Desktop Calculator x 3ea', 'Casio', '8820000000010', 24000, 'in_stock', 60, 1, 3, 30, 0, ARRAY['defective_only'], 83, 87, '{"unitCount":3,"digits":12,"power":"solar+battery"}', 'HUMAN'),
('SCISSORS-5', 'OFFICE', 'PLUS Fitcut Scissors 175mm x 5ea', 'PLUS', '8820000000011', 15000, 'in_stock', 90, 1, 2, 14, 0, ARRAY['opened'], 86, 89, '{"unitCount":5,"length_mm":175,"material":"stainless_steel"}', 'HUMAN'),
('RULER-30CM-10', 'OFFICE', 'Kokuyo Clear Ruler 30cm x 10ea', 'Kokuyo', '8820000000012', 7000, 'in_stock', 250, 1, 2, 7, 0, ARRAY['opened'], 89, 91, '{"unitCount":10,"length_cm":30,"material":"acrylic","transparent":true}', 'HUMAN'),

-- 봉투 & 배송용품
('ENVELOPE-A4-100', 'OFFICE', 'Kraft Envelope A4 120g x 100ea', 'PackMate', '8820000000013', 11000, 'in_stock', 180, 1, 2, 7, 3000, ARRAY['opened'], 87, 90, '{"unitCount":100,"size":"A4","weight_g":120,"type":"kraft"}', 'HUMAN'),
('BUBBLE-WRAP-50M', 'OFFICE', 'PackSafe Bubble Wrap 30cm x 50m x 3rolls', 'PackSafe', '8820000000014', 16000, 'in_stock', 70, 1, 3, 7, 4000, ARRAY['opened'], 85, 88, '{"unitCount":3,"width_cm":30,"length_m":50,"bubble_mm":10}', 'HUMAN'),
('ENVELOPE-PADDED-50', 'OFFICE', 'PackMate Padded Envelope 260x380mm x 50ea', 'PackMate', '8820000000015', 22000, 'in_stock', 95, 1, 2, 7, 3000, ARRAY['opened'], 84, 87, '{"unitCount":50,"size":"260x380mm","padding":"bubble"}', 'HUMAN')

ON CONFLICT (sku) DO UPDATE SET
  title = EXCLUDED.title, brand = EXCLUDED.brand, price = EXCLUDED.price,
  stock_status = EXCLUDED.stock_status, stock_qty = EXCLUDED.stock_qty,
  category = EXCLUDED.category, ai_readiness_score = EXCLUDED.ai_readiness_score,
  seller_trust = EXCLUDED.seller_trust, attributes = EXCLUDED.attributes, updated_at = now();

-- ━━━ 3. IT_EQUIPMENT (IT장비) — 15 items ━━━
INSERT INTO products (sku, category, title, brand, gtin, price, stock_status, stock_qty, ship_by_days, eta_days, return_days, return_fee, return_exceptions, ai_readiness_score, seller_trust, attributes, sourcing_type) VALUES

-- USB & 저장장치
('USB-FLASH-64-10', 'IT_EQUIPMENT', 'SanDisk Ultra Flair USB 3.0 64GB x 10ea', 'SanDisk', '8821000000001', 85000, 'in_stock', 40, 1, 2, 30, 0, ARRAY['defective_only'], 88, 92, '{"unitCount":10,"capacity_GB":64,"interface":"USB3.0","speed_MBs":150}', 'HUMAN'),
('USB-FLASH-128-5', 'IT_EQUIPMENT', 'Samsung BAR Plus USB 3.1 128GB x 5ea', 'Samsung', '8821000000002', 75000, 'in_stock', 25, 1, 2, 30, 0, ARRAY['defective_only'], 90, 94, '{"unitCount":5,"capacity_GB":128,"interface":"USB3.1","speed_MBs":300}', 'HUMAN'),
('SSD-EXTERNAL-1T', 'IT_EQUIPMENT', 'Samsung T7 Portable SSD 1TB', 'Samsung', '8821000000003', 125000, 'in_stock', 15, 1, 3, 30, 0, ARRAY['defective_only'], 85, 90, '{"capacity_TB":1,"interface":"USB-C","speed_MBs":1050,"weight_g":58}', 'HUMAN'),

-- 충전기 & 어댑터
('CHARGER-65W-5', 'IT_EQUIPMENT', 'Anker Nano 65W USB-C Charger x 5ea', 'Anker', '8821000000004', 120000, 'in_stock', 30, 1, 3, 30, 0, ARRAY['defective_only'], 86, 90, '{"unitCount":5,"watts":65,"ports":"USB-C x2","protocol":"PD3.0+PPS"}', 'HUMAN'),
('HUB-USB-C-7P-3', 'IT_EQUIPMENT', 'Anker 7-in-1 USB-C Hub x 3ea', 'Anker', '8821000000005', 98000, 'in_stock', 18, 1, 3, 30, 0, ARRAY['defective_only'], 82, 86, '{"unitCount":3,"ports":["HDMI","USB-A x2","USB-C","SD","MicroSD","PD"],"power_delivery_W":100}', 'HUMAN'),
('MULTIPORT-ADAPTER', 'IT_EQUIPMENT', 'Apple USB-C Digital AV Multiport Adapter', 'Apple', '8821000000006', 79000, 'in_stock', 22, 1, 2, 30, 0, ARRAY['defective_only'], 80, 88, '{"ports":["HDMI","USB-A","USB-C"],"maxResolution":"4K@60Hz"}', 'HUMAN'),

-- 네트워크 & 케이블
('LAN-CAT6-30', 'IT_EQUIPMENT', 'Belkin Cat6 Ethernet Cable 3m x 30ea', 'Belkin', '8821000000007', 45000, 'in_stock', 50, 1, 2, 14, 3000, ARRAY['opened'], 91, 93, '{"unitCount":30,"category":"Cat6","length_m":3,"speed":"1Gbps"}', 'HUMAN'),
('WIFI-ROUTER-AX', 'IT_EQUIPMENT', 'ipTIME AX3000 WiFi 6 Router', 'ipTIME', '8821000000008', 59000, 'in_stock', 12, 1, 3, 30, 5000, ARRAY['defective_only'], 78, 84, '{"standard":"WiFi6","speed_Mbps":3000,"ports":"GbE x4","antenna":4}', 'HUMAN'),

-- 프린터 소모품 (추가)
('TONER-BRO-TN2480', 'IT_EQUIPMENT', 'Brother TN-2480 Compatible Toner x 2ea', 'CompToner', '8821000000009', 42000, 'in_stock', 35, 1, 3, 14, 5000, ARRAY['opened'], 75, 80, '{"unitCount":2,"yield":3000,"compatibleModels":["HL-L2375DW","MFC-L2715DW"]}', 'AI'),
('PAPER-PHOTO-A4-100', 'IT_EQUIPMENT', 'Canon GP-501 Glossy Photo Paper A4 x 100sheets', 'Canon', '8821000000010', 18000, 'in_stock', 60, 1, 3, 14, 3000, ARRAY['opened'], 82, 86, '{"sheets":100,"size":"A4","finish":"glossy","weight_gsm":200}', 'HUMAN'),

-- 모니터 액세서리
('MONITOR-ARM-DUAL', 'IT_EQUIPMENT', 'ErgoTron LX Dual Monitor Arm', 'ErgoTron', '8821000000011', 189000, 'in_stock', 8, 2, 5, 30, 10000, ARRAY['installed'], 72, 78, '{"type":"dual","maxWeight_kg":11.3,"maxSize_inch":34,"vesa":"75x75,100x100"}', 'HUMAN'),
('SCREEN-FILTER-24', 'IT_EQUIPMENT', 'Kensington Privacy Screen Filter 24inch', 'Kensington', '8821000000012', 45000, 'in_stock', 20, 1, 3, 14, 5000, ARRAY['installed'], 76, 80, '{"size_inch":24,"ratio":"16:9","filterAngle":"60°"}', 'HUMAN'),

-- 웹캠 & 헤드셋
('WEBCAM-1080P-3', 'IT_EQUIPMENT', 'Logitech C920 HD Pro Webcam x 3ea', 'Logitech', '8821000000013', 135000, 'in_stock', 10, 1, 3, 30, 0, ARRAY['defective_only'], 80, 85, '{"unitCount":3,"resolution":"1080p","fps":30,"fov":"78°","autofocus":true}', 'HUMAN'),
('HEADSET-USB-5', 'IT_EQUIPMENT', 'Jabra Evolve2 30 USB Headset x 5ea', 'Jabra', '8821000000014', 225000, 'in_stock', 12, 1, 3, 30, 0, ARRAY['defective_only'], 77, 83, '{"unitCount":5,"connectivity":"USB-C","noiseCancelling":true,"microphone":"boom"}', 'HUMAN'),
('POWER-STRIP-USB-5', 'IT_EQUIPMENT', 'Belkin 6-Outlet + 2USB Power Strip x 5ea', 'Belkin', '8821000000015', 65000, 'in_stock', 30, 1, 3, 30, 5000, ARRAY['defective_only'], 83, 87, '{"unitCount":5,"outlets":6,"usbPorts":2,"cableLength_m":1.8,"surge":true}', 'HUMAN')

ON CONFLICT (sku) DO UPDATE SET
  title = EXCLUDED.title, brand = EXCLUDED.brand, price = EXCLUDED.price,
  stock_status = EXCLUDED.stock_status, stock_qty = EXCLUDED.stock_qty,
  category = EXCLUDED.category, ai_readiness_score = EXCLUDED.ai_readiness_score,
  seller_trust = EXCLUDED.seller_trust, attributes = EXCLUDED.attributes, updated_at = now();

-- ━━━ 4. KITCHEN (사무실 주방) — 12 items ━━━
INSERT INTO products (sku, category, title, brand, gtin, price, stock_status, stock_qty, ship_by_days, eta_days, return_days, return_fee, return_exceptions, ai_readiness_score, seller_trust, attributes, sourcing_type) VALUES

-- 음료 & 간식
('COFFEE-DRIP-30', 'KITCHEN', 'KANU Mini Drip Coffee Dark x 30sticks', 'KANU', '8822000000001', 12800, 'in_stock', 300, 1, 2, 30, 0, ARRAY['opened'], 93, 95, '{"unitCount":30,"weight_g":0.9,"type":"drip","roast":"dark"}', 'HUMAN'),
('TEA-EARL-50', 'KITCHEN', 'Twinings Earl Grey Tea x 50bags', 'Twinings', '8822000000002', 14500, 'in_stock', 180, 1, 2, 30, 0, ARRAY['opened'], 90, 93, '{"unitCount":50,"weight_g":2,"type":"black","flavor":"earl_grey"}', 'HUMAN'),
('SNACK-NUT-MIX-30', 'KITCHEN', 'CJ Mixed Nuts 20g x 30packs', 'CJ', '8822000000003', 22000, 'in_stock', 120, 1, 2, 30, 0, ARRAY['opened'], 88, 91, '{"unitCount":30,"weight_g":20,"contains":["almond","walnut","cashew","macadamia"]}', 'HUMAN'),
('WATER-2L-12', 'KITCHEN', 'Jeju SamDaSoo Water 2L x 12ea', 'SamDaSoo', '8822000000004', 11500, 'in_stock', 500, 1, 2, 7, 5000, ARRAY['opened'], 94, 96, '{"unitCount":12,"volume_L":2,"source":"Jeju"}', 'HUMAN'),
('JUICE-ORANGE-24', 'KITCHEN', 'Minute Maid Orange Juice 350ml x 24ea', 'Minute Maid', '8822000000005', 28000, 'in_stock', 80, 1, 2, 14, 5000, ARRAY['opened'], 85, 88, '{"unitCount":24,"volume_ml":350,"flavor":"orange","type":"100%juice"}', 'HUMAN'),

-- 주방 소모품
('WRAP-FOOD-3', 'KITCHEN', 'Clean Wrap Food Wrap 30cm x 100m x 3rolls', 'CleanWrap', '8822000000006', 12000, 'in_stock', 200, 1, 2, 7, 3000, ARRAY['opened'], 87, 90, '{"unitCount":3,"width_cm":30,"length_m":100,"material":"PE"}', 'HUMAN'),
('FOIL-ALUM-3', 'KITCHEN', 'Clean Wrap Aluminum Foil 30cm x 50m x 3rolls', 'CleanWrap', '8822000000007', 15000, 'in_stock', 150, 1, 2, 7, 3000, ARRAY['opened'], 86, 89, '{"unitCount":3,"width_cm":30,"length_m":50,"material":"aluminum"}', 'HUMAN'),
('ZIPPER-BAG-100', 'KITCHEN', 'CleanWrap Zipper Bag M 18x22cm x 100ea', 'CleanWrap', '8822000000008', 8500, 'in_stock', 250, 1, 2, 7, 0, ARRAY['opened'], 89, 91, '{"unitCount":100,"size":"18x22cm","type":"zipper","microwave":true}', 'HUMAN'),

-- 주방 도구
('CHOPSTICK-ST-20', 'KITCHEN', 'Stainless Steel Chopsticks x 20pairs', 'KoreaHome', '8822000000009', 16000, 'in_stock', 100, 1, 3, 14, 3000, ARRAY['opened'], 84, 87, '{"unitCount":20,"material":"stainless_steel_304","length_cm":23}', 'HUMAN'),
('SPOON-ST-20', 'KITCHEN', 'Stainless Steel Spoon x 20ea', 'KoreaHome', '8822000000010', 14000, 'in_stock', 100, 1, 3, 14, 3000, ARRAY['opened'], 84, 87, '{"unitCount":20,"material":"stainless_steel_304","length_cm":21}', 'HUMAN'),
('CUP-TUMBLER-10', 'KITCHEN', 'Lock&Lock Insulated Tumbler 400ml x 10ea', 'Lock&Lock', '8822000000011', 55000, 'in_stock', 35, 1, 3, 30, 5000, ARRAY['defective_only'], 80, 85, '{"unitCount":10,"volume_ml":400,"insulation":"double_wall","material":"stainless_steel"}', 'HUMAN'),
('DETERGENT-DISH-6', 'KITCHEN', 'LG LiQ Dish Detergent 750ml x 6ea', 'LG', '8822000000012', 16800, 'in_stock', 160, 1, 2, 14, 4000, ARRAY['opened'], 88, 91, '{"unitCount":6,"volume_ml":750,"scent":"green_grape"}', 'HUMAN')

ON CONFLICT (sku) DO UPDATE SET
  title = EXCLUDED.title, brand = EXCLUDED.brand, price = EXCLUDED.price,
  stock_status = EXCLUDED.stock_status, stock_qty = EXCLUDED.stock_qty,
  category = EXCLUDED.category, ai_readiness_score = EXCLUDED.ai_readiness_score,
  seller_trust = EXCLUDED.seller_trust, attributes = EXCLUDED.attributes, updated_at = now();

-- ━━━ 5. SAFETY (안전용품) — 12 items ━━━
INSERT INTO products (sku, category, title, brand, gtin, price, stock_status, stock_qty, ship_by_days, eta_days, return_days, return_fee, return_exceptions, ai_readiness_score, seller_trust, attributes, sourcing_type) VALUES

-- 안전 표지판 & 테이프
('SIGN-EXIT-LED-3', 'SAFETY', 'FireSign LED Exit Sign (Battery Backup) x 3ea', 'FireSign', '8823000000001', 75000, 'in_stock', 15, 2, 5, 14, 10000, ARRAY['installed'], 78, 82, '{"unitCount":3,"type":"LED","battery":"NiCd","brightness_cd":50}', 'HUMAN'),
('TAPE-HAZARD-5', 'SAFETY', 'SafeMark Hazard Warning Tape 48mm x 33m x 5rolls', 'SafeMark', '8823000000002', 18000, 'in_stock', 80, 1, 3, 7, 3000, ARRAY['opened'], 87, 90, '{"unitCount":5,"width_mm":48,"length_m":33,"color":"yellow/black"}', 'HUMAN'),
('CONE-SAFETY-10', 'SAFETY', 'SafeZone Traffic Safety Cone 45cm x 10ea', 'SafeZone', '8823000000003', 35000, 'in_stock', 25, 2, 4, 14, 5000, ARRAY['damaged'], 82, 86, '{"unitCount":10,"height_cm":45,"material":"PVC","reflective":true}', 'HUMAN'),

-- 보호구
('VEST-REFLECT-10', 'SAFETY', 'SafeWear High-Vis Reflective Vest x 10ea', 'SafeWear', '8823000000004', 28000, 'in_stock', 50, 1, 3, 14, 3000, ARRAY['damaged'], 85, 88, '{"unitCount":10,"size":"free","color":"neon_yellow","reflective_strips":2}', 'HUMAN'),
('GOGGLE-SAFETY-10', 'SAFETY', 'SafeView Impact Safety Goggles x 10ea', 'SafeView', '8823000000005', 32000, 'in_stock', 40, 1, 3, 14, 3000, ARRAY['opened'], 84, 87, '{"unitCount":10,"lens":"polycarbonate","anti_fog":true,"uv_protection":true}', 'HUMAN'),
('GLOVE-WORK-20', 'SAFETY', 'GripMax Nitrile Work Gloves L x 20pairs', 'GripMax', '8823000000006', 22000, 'in_stock', 100, 1, 2, 7, 3000, ARRAY['opened'], 88, 91, '{"unitCount":20,"size":"L","material":"nitrile_coated","cut_resistance":"level3"}', 'HUMAN'),
('EARPLUG-100', 'SAFETY', 'QuietZone Foam Ear Plugs NRR 33 x 100pairs', 'QuietZone', '8823000000007', 15000, 'in_stock', 120, 1, 2, 7, 0, ARRAY['opened'], 90, 93, '{"unitCount":100,"nrr":33,"type":"foam","disposable":true}', 'HUMAN'),
('HARHAT-WHITE-5', 'SAFETY', 'SafeHead ABS Hard Hat White x 5ea', 'SafeHead', '8823000000008', 45000, 'in_stock', 20, 2, 4, 14, 5000, ARRAY['damaged'], 80, 84, '{"unitCount":5,"material":"ABS","color":"white","suspension":"ratchet","ventilated":true}', 'HUMAN'),

-- 응급 & 비상
('BLANKET-EMERG-10', 'SAFETY', 'LifeGuard Emergency Thermal Blanket x 10ea', 'LifeGuard', '8823000000009', 12000, 'in_stock', 60, 1, 2, 7, 0, ARRAY['opened'], 86, 89, '{"unitCount":10,"size":"210x160cm","material":"mylar","reusable":false}', 'HUMAN'),
('LIGHT-EMERG-5', 'SAFETY', 'SafeGlow Emergency LED Flashlight x 5ea', 'SafeGlow', '8823000000010', 25000, 'in_stock', 45, 1, 3, 30, 3000, ARRAY['defective_only'], 83, 87, '{"unitCount":5,"lumens":300,"battery":"AAA x3","waterproof":"IPX4"}', 'HUMAN'),
('KIT-EMERG-CORP', 'SAFETY', 'SafeFirst Corporate Emergency Kit (100 person)', 'SafeFirst', '8823000000011', 180000, 'in_stock', 8, 2, 5, 30, 10000, ARRAY['opened'], 75, 82, '{"capacity":"100_person","items":85,"includes":["first_aid","flashlight","blankets","radio"]}', 'HUMAN'),
('EXTINGUISHER-CO2', 'SAFETY', 'FireStop CO2 Fire Extinguisher 3.3kg', 'FireStop', '8823000000012', 65000, 'in_stock', 10, 2, 5, 30, 10000, ARRAY['used'], 81, 85, '{"weight_kg":3.3,"type":"CO2","rating":"5B-C","class":["B","C","electrical"]}', 'HUMAN')

ON CONFLICT (sku) DO UPDATE SET
  title = EXCLUDED.title, brand = EXCLUDED.brand, price = EXCLUDED.price,
  stock_status = EXCLUDED.stock_status, stock_qty = EXCLUDED.stock_qty,
  category = EXCLUDED.category, ai_readiness_score = EXCLUDED.ai_readiness_score,
  seller_trust = EXCLUDED.seller_trust, attributes = EXCLUDED.attributes, updated_at = now();

-- ━━━ 6. HYGIENE (위생용품) — 12 items ━━━
INSERT INTO products (sku, category, title, brand, gtin, price, stock_status, stock_qty, ship_by_days, eta_days, return_days, return_fee, return_exceptions, ai_readiness_score, seller_trust, attributes, sourcing_type) VALUES

-- 세정 & 소독
('SPRAY-DISINFECT-6', 'HYGIENE', 'Clorox Disinfecting Spray 500ml x 6ea', 'Clorox', '8824000000001', 35000, 'in_stock', 80, 1, 2, 14, 5000, ARRAY['opened'], 89, 92, '{"unitCount":6,"volume_ml":500,"kills":"99.9%","scent":"fresh"}', 'HUMAN'),
('WIPE-DISINFECT-80-6', 'HYGIENE', 'Clorox Disinfecting Wipes 80ct x 6ea', 'Clorox', '8824000000002', 42000, 'in_stock', 60, 1, 2, 14, 5000, ARRAY['opened'], 88, 91, '{"unitCount":6,"sheets":80,"kills":"99.9%","biodegradable":false}', 'HUMAN'),
('SANITIZER-GEL-1L-4', 'HYGIENE', 'PureGuard Hand Sanitizer Gel 1L x 4ea', 'PureGuard', '8824000000003', 28000, 'in_stock', 90, 1, 2, 14, 5000, ARRAY['opened'], 90, 93, '{"unitCount":4,"volume_L":1,"alcoholPercent":70,"type":"gel","pump":true}', 'HUMAN'),
('SANITIZER-STAND', 'HYGIENE', 'PureGuard Touchless Sanitizer Dispenser Stand', 'PureGuard', '8824000000004', 89000, 'in_stock', 12, 2, 5, 30, 10000, ARRAY['installed'], 75, 80, '{"type":"touchless","sensor":"infrared","capacity_ml":1200,"battery":"AA x4"}', 'HUMAN'),

-- 화장실 용품
('TOILET-SEAT-50', 'HYGIENE', 'CleanSeat Disposable Toilet Seat Cover x 50packs (10ea/pack)', 'CleanSeat', '8824000000005', 32000, 'in_stock', 55, 1, 3, 7, 3000, ARRAY['opened'], 84, 87, '{"packs":50,"sheets_per_pack":10,"material":"paper","flushable":true}', 'HUMAN'),
('PAPER-TOWEL-12', 'HYGIENE', 'Scott Multi-fold Paper Towels 200ct x 12packs', 'Scott', '8824000000006', 25000, 'in_stock', 100, 1, 2, 7, 5000, ARRAY['opened'], 91, 94, '{"unitCount":12,"sheets":200,"type":"multi_fold","absorbency":"high"}', 'HUMAN'),
('SOAP-FOAM-REFILL-4', 'HYGIENE', 'Method Foaming Hand Soap Refill 1L x 4ea', 'Method', '8824000000007', 36000, 'in_stock', 70, 1, 2, 14, 5000, ARRAY['opened'], 86, 89, '{"unitCount":4,"volume_L":1,"type":"foam","scent":"sea_minerals"}', 'HUMAN'),

-- 방역 & 마스크
('MASK-KF80-100', 'HYGIENE', 'AirClean KF80 Mask White x 100ea', 'AirClean', '8824000000008', 55000, 'in_stock', 45, 1, 2, 7, 0, ARRAY['hygiene'], 87, 90, '{"unitCount":100,"rating":"KF80","color":"white","type":"fold"}', 'HUMAN'),
('MASK-DENTAL-300', 'HYGIENE', 'MediGuard Dental Mask 3-Ply x 300ea', 'MediGuard', '8824000000009', 42000, 'in_stock', 70, 1, 2, 7, 0, ARRAY['hygiene'], 88, 91, '{"unitCount":300,"layers":3,"type":"ear_loop","bfe":"98%"}', 'HUMAN'),
('SHOE-COVER-100', 'HYGIENE', 'CleanStep Disposable Shoe Cover x 100pairs', 'CleanStep', '8824000000010', 18000, 'in_stock', 80, 1, 2, 7, 0, ARRAY['opened'], 85, 88, '{"unitCount":100,"material":"PE","size":"free","waterproof":true}', 'HUMAN'),

-- 방향 & 탈취
('AIR-FRESH-AUTO-5', 'HYGIENE', 'Febreze Auto Air Freshener Refill x 5ea', 'Febreze', '8824000000011', 25000, 'in_stock', 90, 1, 2, 14, 0, ARRAY['opened'], 83, 86, '{"unitCount":5,"volume_ml":250,"scent":"spring","type":"auto_spray"}', 'HUMAN'),
('DEODOR-RESTROOM-10', 'HYGIENE', 'FreshZone Restroom Deodorizer Block x 10ea', 'FreshZone', '8824000000012', 15000, 'in_stock', 110, 1, 2, 14, 0, ARRAY['opened'], 81, 85, '{"unitCount":10,"duration_days":30,"scent":"pine","placement":"urinal"}', 'HUMAN')

ON CONFLICT (sku) DO UPDATE SET
  title = EXCLUDED.title, brand = EXCLUDED.brand, price = EXCLUDED.price,
  stock_status = EXCLUDED.stock_status, stock_qty = EXCLUDED.stock_qty,
  category = EXCLUDED.category, ai_readiness_score = EXCLUDED.ai_readiness_score,
  seller_trust = EXCLUDED.seller_trust, attributes = EXCLUDED.attributes, updated_at = now();

-- ━━━ 7. Additional CONSUMABLES (기존 카테고리 추가) — 8 items ━━━
INSERT INTO products (sku, category, title, brand, gtin, price, stock_status, stock_qty, ship_by_days, eta_days, return_days, return_fee, return_exceptions, ai_readiness_score, seller_trust, attributes, sourcing_type) VALUES

('COFFEE-CAPSULE-50', 'CONSUMABLES', 'Nespresso Compatible Capsule Assorted x 50ea', 'CafeRoyal', '8825000000001', 28000, 'in_stock', 90, 1, 2, 30, 0, ARRAY['opened'], 87, 90, '{"unitCount":50,"type":"nespresso_compatible","flavors":["espresso","lungo","ristretto"]}', 'HUMAN'),
('TEA-CHAMOMILE-50', 'CONSUMABLES', 'Twinings Chamomile Tea x 50bags', 'Twinings', '8825000000002', 13500, 'in_stock', 160, 1, 2, 30, 0, ARRAY['opened'], 89, 92, '{"unitCount":50,"weight_g":1.5,"type":"herbal","caffeine_free":true}', 'HUMAN'),
('PAPER-CUP-2000', 'CONSUMABLES', 'EcoCup Paper Cup 180ml x 2000ea', 'EcoCup', '8825000000003', 38000, 'in_stock', 40, 1, 3, 7, 5000, ARRAY['opened'], 90, 93, '{"unitCount":2000,"volume_ml":180,"material":"paper","eco":true}', 'HUMAN'),
('STRAW-PAPER-500', 'CONSUMABLES', 'EcoStraw Paper Straw 6mm x 500ea', 'EcoStraw', '8825000000004', 12000, 'in_stock', 130, 1, 2, 7, 0, ARRAY['opened'], 88, 91, '{"unitCount":500,"diameter_mm":6,"length_mm":210,"material":"paper","eco":true}', 'HUMAN'),
('PLATE-PAPER-200', 'CONSUMABLES', 'EcoCup Paper Plate 180mm x 200ea', 'EcoCup', '8825000000005', 15000, 'in_stock', 100, 1, 2, 7, 3000, ARRAY['opened'], 86, 89, '{"unitCount":200,"diameter_mm":180,"material":"sugarcane_pulp","microwave":true}', 'HUMAN'),
('NAPKIN-2PLY-5000', 'CONSUMABLES', 'SoftTouch Lunch Napkin 2-Ply x 5000ea', 'SoftTouch', '8825000000006', 22000, 'in_stock', 70, 1, 2, 7, 3000, ARRAY['opened'], 91, 94, '{"unitCount":5000,"ply":2,"size":"330x330mm","color":"white"}', 'HUMAN'),
('STIRRER-WOOD-1000', 'CONSUMABLES', 'EcoStir Wooden Stirrer 140mm x 1000ea', 'EcoStir', '8825000000007', 6500, 'in_stock', 200, 1, 2, 7, 0, ARRAY['opened'], 89, 92, '{"unitCount":1000,"length_mm":140,"material":"birch_wood"}', 'HUMAN'),
('LID-PAPER-CUP-1000', 'CONSUMABLES', 'EcoCup PS Lid for 180ml Cup x 1000ea', 'EcoCup', '8825000000008', 18000, 'in_stock', 60, 1, 2, 7, 3000, ARRAY['opened'], 87, 90, '{"unitCount":1000,"fitsCups":"180ml","material":"PS","siphole":true}', 'HUMAN')

ON CONFLICT (sku) DO UPDATE SET
  title = EXCLUDED.title, brand = EXCLUDED.brand, price = EXCLUDED.price,
  stock_status = EXCLUDED.stock_status, stock_qty = EXCLUDED.stock_qty,
  category = EXCLUDED.category, ai_readiness_score = EXCLUDED.ai_readiness_score,
  seller_trust = EXCLUDED.seller_trust, attributes = EXCLUDED.attributes, updated_at = now();

-- ━━━ 8. Additional MRO (기존 카테고리 추가) — 8 items ━━━
INSERT INTO products (sku, category, title, brand, gtin, price, stock_status, stock_qty, ship_by_days, eta_days, return_days, return_fee, return_exceptions, ai_readiness_score, seller_trust, attributes, sourcing_type) VALUES

('LAMP-DESK-LED-5', 'MRO', 'PhilipsLED Desk Lamp 10W Dimmable x 5ea', 'Philips', '8826000000001', 95000, 'in_stock', 15, 2, 4, 30, 5000, ARRAY['defective_only'], 79, 84, '{"unitCount":5,"watt":10,"colorTemp_K":"3000-6500","dimmable":true,"usb_port":true}', 'HUMAN'),
('CHAIR-MAT-CARPET', 'MRO', 'Floortex Chair Mat for Carpet 120x90cm', 'Floortex', '8826000000002', 42000, 'in_stock', 18, 2, 4, 14, 5000, ARRAY['damaged'], 76, 80, '{"size":"120x90cm","material":"polycarbonate","surface":"carpet","lip":true}', 'HUMAN'),
('HOOK-3M-CMD-20', 'MRO', '3M Command Hook Medium x 20ea', '3M', '8826000000003', 25000, 'in_stock', 80, 1, 2, 14, 0, ARRAY['opened'], 88, 91, '{"unitCount":20,"size":"medium","weight_capacity_kg":1.3,"removable":true}', 'HUMAN'),
('CABLE-TIE-500', 'MRO', 'PackRight Nylon Cable Tie 200mm x 500ea', 'PackRight', '8826000000004', 8000, 'in_stock', 200, 1, 2, 7, 0, ARRAY['opened'], 91, 93, '{"unitCount":500,"length_mm":200,"width_mm":3.6,"material":"nylon66","color":"black"}', 'HUMAN'),
('TUBE-LED-T8-10', 'MRO', 'BrightLux T8 LED Tube 18W 120cm x 10ea', 'BrightLux', '8826000000005', 65000, 'in_stock', 20, 2, 4, 14, 5000, ARRAY['installed'], 77, 82, '{"unitCount":10,"watt":18,"length_cm":120,"lumen":2200,"colorTemp_K":6500}', 'HUMAN'),
('PAINT-WHITE-18L', 'MRO', 'KCC Interior Paint White Matt 18L', 'KCC', '8826000000006', 55000, 'in_stock', 10, 2, 5, 7, 10000, ARRAY['opened'], 74, 78, '{"volume_L":18,"color":"white","finish":"matt","coverage_sqm":90,"voc":"low"}', 'HUMAN'),
('DRILL-BIT-SET', 'MRO', 'Bosch HSS Drill Bit Set 1-10mm 19pcs', 'Bosch', '8826000000007', 32000, 'in_stock', 25, 1, 3, 30, 5000, ARRAY['defective_only'], 80, 85, '{"pieces":19,"range_mm":"1-10","material":"HSS-G","shank":"round"}', 'HUMAN'),
('TOOLBOX-BASIC', 'MRO', 'Stanley Basic Tool Kit 38pcs with Box', 'Stanley', '8826000000008', 45000, 'in_stock', 12, 2, 4, 30, 5000, ARRAY['damaged'], 78, 83, '{"pieces":38,"includes":["hammer","pliers","screwdrivers","wrench","tape_measure"],"case":"blow_mold"}', 'HUMAN')

ON CONFLICT (sku) DO UPDATE SET
  title = EXCLUDED.title, brand = EXCLUDED.brand, price = EXCLUDED.price,
  stock_status = EXCLUDED.stock_status, stock_qty = EXCLUDED.stock_qty,
  category = EXCLUDED.category, ai_readiness_score = EXCLUDED.ai_readiness_score,
  seller_trust = EXCLUDED.seller_trust, attributes = EXCLUDED.attributes, updated_at = now();

-- ━━━ Summary ━━━
-- OFFICE:        15 new items (노트, 클립, 스테이플러, 화이트보드, 계산기, 가위, 봉투 등)
-- IT_EQUIPMENT:  15 new items (USB, SSD, 충전기, 허브, 공유기, 토너, 모니터암, 웹캠 등)
-- KITCHEN:       12 new items (커피, 차, 간식, 음료, 랩, 호일, 수저, 텀블러 등)
-- SAFETY:        12 new items (표지판, 안전콘, 반사조끼, 고글, 안전모, 비상키트 등)
-- HYGIENE:       12 new items (소독스프레이, 소독티슈, 손소독기, 마스크, 방향제 등)
-- CONSUMABLES:    8 new items (커피캡슐, 종이컵, 빨대, 냅킨, 교반봉 등)
-- MRO:            8 new items (데스크램프, 체어매트, 3M후크, 케이블타이, 페인트 등)
-- TOTAL:         82 new products across 7 categories
