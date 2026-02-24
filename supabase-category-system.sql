-- ============================================
-- 도매꾹 카테고리 시스템 통합
-- 1. DB category constraint 확장
-- 2. 카테고리 캐시 테이블 생성
-- 3. getCategoryList API 호출 RPC 함수
-- 4. 도매꾹코드 → JSONMart 카테고리 매핑 테이블
-- Run in Supabase SQL Editor
-- ============================================

-- ━━━ 1. DB category constraint 확장 ━━━
-- 기존 CONSUMABLES, MRO, OFFICE, FOOD, HOUSEHOLD, FASHION, BEAUTY, DIGITAL, SPORTS, OTHER
-- 에 PETS, BABY, KITCHEN, SAFETY, HYGIENE, IT_EQUIPMENT, AUTOMOTIVE, TOYS, HEALTH, INTERIOR 추가
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_category_check;
ALTER TABLE products ADD CONSTRAINT products_category_check
  CHECK (category IN (
    'CONSUMABLES', 'MRO', 'OFFICE', 'FOOD', 'HOUSEHOLD',
    'FASHION', 'BEAUTY', 'DIGITAL', 'SPORTS', 'OTHER',
    'PETS', 'BABY', 'KITCHEN', 'SAFETY', 'HYGIENE',
    'IT_EQUIPMENT', 'AUTOMOTIVE', 'TOYS', 'HEALTH', 'INTERIOR'
  ));

-- ━━━ 2. 도매꾹 카테고리 캐시 테이블 ━━━
CREATE TABLE IF NOT EXISTS dome_categories (
  code        TEXT PRIMARY KEY,        -- ex) 01_01_01_00_00
  name        TEXT NOT NULL,           -- 카테고리 이름
  depth       INT NOT NULL DEFAULT 1,  -- 계층 레벨 (1=대, 2=중, 3=소, 4=세, 5=세세)
  parent_code TEXT,                    -- 부모 카테고리 코드
  locked      BOOLEAN DEFAULT false,   -- 등록 제한 여부
  jsonmart_category TEXT DEFAULT 'OTHER', -- JSONMart 매핑 카테고리
  fetched_at  TIMESTAMPTZ DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_dome_categories_depth ON dome_categories(depth);
CREATE INDEX IF NOT EXISTS idx_dome_categories_parent ON dome_categories(parent_code);
CREATE INDEX IF NOT EXISTS idx_dome_categories_jsonmart ON dome_categories(jsonmart_category);

-- ━━━ 3. 도매꾹 대분류 → JSONMart 카테고리 기본 매핑 삽입 ━━━
-- 도매꾹 대분류 코드 기반 매핑 (getCategoryList에서 실제 코드 확인 후 업데이트 가능)
INSERT INTO dome_categories (code, name, depth, parent_code, jsonmart_category) VALUES
  ('01_00_00_00_00', '패션잡화/화장품', 1, NULL, 'FASHION'),
  ('02_00_00_00_00', '패션의류', 1, NULL, 'FASHION'),
  ('03_00_00_00_00', '식품', 1, NULL, 'FOOD'),
  ('04_00_00_00_00', '생활/주방', 1, NULL, 'HOUSEHOLD'),
  ('05_00_00_00_00', '문구/사무/취미', 1, NULL, 'OFFICE'),
  ('06_00_00_00_00', '디지털/가전', 1, NULL, 'DIGITAL'),
  ('07_00_00_00_00', '스포츠/레저', 1, NULL, 'SPORTS'),
  ('08_00_00_00_00', '유아/아동', 1, NULL, 'BABY'),
  ('09_00_00_00_00', '자동차용품', 1, NULL, 'AUTOMOTIVE'),
  ('10_00_00_00_00', '건강/의료', 1, NULL, 'HEALTH'),
  ('11_00_00_00_00', '도서/음반', 1, NULL, 'OTHER'),
  ('12_00_00_00_00', '인테리어/가구', 1, NULL, 'INTERIOR'),
  ('13_00_00_00_00', '반려동물', 1, NULL, 'PETS'),
  ('14_00_00_00_00', '산업/안전', 1, NULL, 'SAFETY'),
  ('15_00_00_00_00', '화장품/뷰티', 1, NULL, 'BEAUTY')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  jsonmart_category = EXCLUDED.jsonmart_category;

-- ━━━ 4. getCategoryList API 호출 RPC ━━━
CREATE OR REPLACE FUNCTION domeggook_categories()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_url TEXT;
  v_response http_response;
  v_body JSONB;
BEGIN
  -- Auth check
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'AUTH_REQUIRED');
  END IF;

  -- Build request URL
  v_url := 'https://domeggook.com/ssl/api/?ver=1.0&mode=getCategoryList'
    || '&aid=59a4d8f9efc963d6446f86615902e416'
    || '&om=json&isReg=true';

  -- Make HTTP GET request
  SELECT * INTO v_response FROM http_get(v_url);

  -- Parse response
  IF v_response.status = 200 THEN
    v_body := v_response.content::JSONB;
    RETURN v_body;
  ELSE
    RETURN jsonb_build_object(
      'error', 'API_ERROR',
      'status', v_response.status,
      'message', 'Domeggook Category API returned status ' || v_response.status::TEXT
    );
  END IF;

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'error', 'REQUEST_FAILED',
    'message', SQLERRM
  );
END;
$$;

-- ━━━ 5. 카테고리 캐시 업데이트 함수 ━━━
-- 도매꾹 API에서 가져온 카테고리를 dome_categories 테이블에 저장
CREATE OR REPLACE FUNCTION sync_dome_categories(p_categories JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item JSONB;
  v_child JSONB;
  v_sub JSONB;
  v_count INT := 0;
  v_parent_code TEXT;
  v_code TEXT;
  v_name TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'AUTH_REQUIRED');
  END IF;

  -- Process top-level categories (depth 1)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_categories)
  LOOP
    v_code := v_item->>'code';
    v_name := v_item->>'name';
    
    INSERT INTO dome_categories (code, name, depth, parent_code, locked, fetched_at)
    VALUES (v_code, v_name, 1, NULL, COALESCE((v_item->>'locked')::BOOLEAN, false), now())
    ON CONFLICT (code) DO UPDATE SET
      name = EXCLUDED.name, locked = EXCLUDED.locked, fetched_at = now();
    v_count := v_count + 1;

    -- Process depth 2
    IF v_item->'child' IS NOT NULL THEN
      FOR v_child IN SELECT * FROM jsonb_array_elements(
        CASE jsonb_typeof(v_item->'child') WHEN 'array' THEN v_item->'child' ELSE jsonb_build_array(v_item->'child') END
      )
      LOOP
        INSERT INTO dome_categories (code, name, depth, parent_code, locked, fetched_at)
        VALUES (v_child->>'code', v_child->>'name', 2, v_code, COALESCE((v_child->>'locked')::BOOLEAN, false), now())
        ON CONFLICT (code) DO UPDATE SET
          name = EXCLUDED.name, parent_code = v_code, locked = EXCLUDED.locked, fetched_at = now();
        v_count := v_count + 1;

        -- Process depth 3
        IF v_child->'child' IS NOT NULL THEN
          FOR v_sub IN SELECT * FROM jsonb_array_elements(
            CASE jsonb_typeof(v_child->'child') WHEN 'array' THEN v_child->'child' ELSE jsonb_build_array(v_child->'child') END
          )
          LOOP
            INSERT INTO dome_categories (code, name, depth, parent_code, locked, fetched_at)
            VALUES (v_sub->>'code', v_sub->>'name', 3, v_child->>'code', COALESCE((v_sub->>'locked')::BOOLEAN, false), now())
            ON CONFLICT (code) DO UPDATE SET
              name = EXCLUDED.name, parent_code = v_child->>'code', locked = EXCLUDED.locked, fetched_at = now();
            v_count := v_count + 1;
          END LOOP;
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('synced', v_count);
END;
$$;

-- ━━━ 6. 카테고리 코드로 JSONMart 매핑 조회 함수 ━━━
CREATE OR REPLACE FUNCTION get_jsonmart_category(p_dome_code TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_category TEXT;
  v_parent TEXT;
BEGIN
  -- 직접 매핑 확인
  SELECT jsonmart_category INTO v_category
  FROM dome_categories WHERE code = p_dome_code AND jsonmart_category != 'OTHER';
  
  IF v_category IS NOT NULL THEN
    RETURN v_category;
  END IF;

  -- 부모 카테고리로 올라가며 매핑 확인
  SELECT parent_code INTO v_parent FROM dome_categories WHERE code = p_dome_code;
  
  WHILE v_parent IS NOT NULL LOOP
    SELECT jsonmart_category INTO v_category
    FROM dome_categories WHERE code = v_parent AND jsonmart_category != 'OTHER';
    
    IF v_category IS NOT NULL THEN
      RETURN v_category;
    END IF;
    
    SELECT parent_code INTO v_parent FROM dome_categories WHERE code = v_parent;
  END LOOP;

  RETURN 'OTHER';
END;
$$;

-- Permissions
GRANT EXECUTE ON FUNCTION domeggook_categories() TO authenticated;
GRANT EXECUTE ON FUNCTION sync_dome_categories(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION get_jsonmart_category(TEXT) TO authenticated;

GRANT SELECT, INSERT, UPDATE ON dome_categories TO authenticated;
REVOKE DELETE ON dome_categories FROM authenticated;
