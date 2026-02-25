-- ============================================
-- Seller Order Management - Schema Fix
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. 셀러 연결 컬럼 추가
ALTER TABLE orders ADD COLUMN IF NOT EXISTS seller_id TEXT;

-- 2. 발송 관리 컬럼 추가
ALTER TABLE orders ADD COLUMN IF NOT EXISTS carrier TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ;

-- 3. procurement_status CHECK 확장 (기존 제약 조건 삭제 후 재생성)
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_procurement_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_procurement_status_check
  CHECK (procurement_status IN (
    'pending',           -- 신규 주문
    'exported',          -- 도매꾹 엑셀 내보내기 완료
    'ordered',           -- 도매꾹 발주 완료
    'confirmed',         -- 셀러 확인/발송대기
    'shipped',           -- 배송중
    'delivered',         -- 배송완료
    'return_requested',  -- 반품 요청
    'returned',          -- 반품 완료
    'cancelled'          -- 취소
  ));

-- 4. 인덱스
CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_tracking ON orders(tracking_number);

-- 5. 기존 주문에 seller_id 매핑 (items JSONB 안의 seller_id 활용)
-- 기존 주문 중 seller_id가 없는 것은 JSONMart 기본 셀러로 매핑
UPDATE orders SET seller_id = 'SLR-JSONMART' WHERE seller_id IS NULL;
