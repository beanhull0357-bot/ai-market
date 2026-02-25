-- ━━━ 셀러 상품 필드 확장 마이그레이션 ━━━
-- 실행: Supabase SQL Editor에서 실행

-- 1. delivery_fee 컬럼 추가 (이미 있으면 무시)
ALTER TABLE products ADD COLUMN IF NOT EXISTS delivery_fee JSONB DEFAULT '{}';

-- 2. source 컬럼 추가 (이미 있으면 무시)
ALTER TABLE products ADD COLUMN IF NOT EXISTS source TEXT;

-- 3. source_url 컬럼 추가 (이미 있으면 무시)
ALTER TABLE products ADD COLUMN IF NOT EXISTS source_url TEXT;

-- 4. 기존 도매매 상품에 source 값 설정 (아직 없는 경우)
UPDATE products SET source = 'domeggook' WHERE sku LIKE 'DOME-%' AND source IS NULL;

-- 5. 기존 셀러 상품에 source 값 설정
UPDATE products SET source = 'seller' WHERE seller_id IS NOT NULL AND source IS NULL;

-- 6. seller_upload_products RPC 재생성 (delivery_fee, source 지원)
-- ⚠️ 이 함수는 supabase-sellers.sql의 전체 RPC를 재실행해야 합니다.
-- supabase-sellers.sql 파일의 seller_upload_products 함수 부분을 
-- Supabase SQL Editor에 붙여넣어 실행하세요.

SELECT 'Migration complete. Run seller_upload_products RPC from supabase-sellers.sql next.' AS status;
