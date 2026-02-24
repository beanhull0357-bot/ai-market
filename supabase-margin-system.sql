-- =============================================
-- JSONMart 마진 시스템 DB 스키마 변경
-- 실행: Supabase SQL Editor에서 실행
-- =============================================

-- 1. 원가/마진 관련 컬럼 추가
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price integer;           -- 도매 원가 (도매꾹 price.dome)
ALTER TABLE products ADD COLUMN IF NOT EXISTS margin_rate decimal(5,2);     -- 적용 마진율 (%)
ALTER TABLE products ADD COLUMN IF NOT EXISTS min_sell_price integer;       -- 최저판매준수가격 (price.resale.minimum)
ALTER TABLE products ADD COLUMN IF NOT EXISTS recommended_price integer;    -- 추천판매가 (price.resale.Recommand)
ALTER TABLE products ADD COLUMN IF NOT EXISTS supply_price integer;         -- 도매매 단가 (price.supply)

-- 2. 배송비 상세 정보
ALTER TABLE products ADD COLUMN IF NOT EXISTS delivery_fee jsonb DEFAULT '{}';  -- 배송비 상세
-- 구조: { "method": "택배", "pay": "무료배송", "dome_fee": 2500, "dome_type": "고정배송비",
--         "jeju_extra": 3000, "islands_extra": 5000, "merge_enable": "y" }

-- 3. 상품 부가 정보
ALTER TABLE products ADD COLUMN IF NOT EXISTS purchase_unit integer DEFAULT 1;  -- 구매단위
ALTER TABLE products ADD COLUMN IF NOT EXISTS max_order_qty integer;             -- 최대구매수량
ALTER TABLE products ADD COLUMN IF NOT EXISTS seller_type text;                 -- 사업자유형 (일반과세자/간이과세자/개인판매자/면세사업자)
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_popular boolean DEFAULT false;  -- 인기상품 여부
ALTER TABLE products ADD COLUMN IF NOT EXISTS has_options boolean DEFAULT false; -- 주문옵션 유무

-- 4. 기존 상품 원가 마이그레이션 (현재 price가 원가이므로)
-- 기존 도매꾹 상품의 price를 cost_price로 복사, 그후 price에 마진 적용
UPDATE products
SET cost_price = price
WHERE source = 'domeggook' AND cost_price IS NULL;

-- 5. 마진 적용 (기본 20%, 저가 30%, 고가 15%)
UPDATE products
SET 
    margin_rate = CASE
        WHEN cost_price < 3000 THEN 30.0
        WHEN cost_price > 50000 THEN 15.0
        ELSE 20.0
    END,
    price = CASE
        WHEN cost_price < 3000 THEN CEIL(cost_price * 1.3 / 10.0) * 10
        WHEN cost_price > 50000 THEN CEIL(cost_price * 1.15 / 10.0) * 10
        ELSE CEIL(cost_price * 1.2 / 10.0) * 10
    END
WHERE source = 'domeggook' AND cost_price IS NOT NULL AND margin_rate IS NULL;

-- 6. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_products_cost_price ON products (cost_price);
CREATE INDEX IF NOT EXISTS idx_products_margin_rate ON products (margin_rate);
CREATE INDEX IF NOT EXISTS idx_products_source ON products (source);
