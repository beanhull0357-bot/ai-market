-- ============================================
-- 도매꾹 카테고리 데이터 로드
-- getCategoryList API 응답을 dome_categories에 삽입
-- SQL Editor에서 직접 실행
-- ============================================

-- 기존 데이터 클리어 (기본 매핑 포함)
TRUNCATE dome_categories;

-- ━━━ 재귀 파싱 함수 (객체 형식 → 테이블 삽입) ━━━
CREATE OR REPLACE FUNCTION load_dome_categories_from_api()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_response TEXT;
  v_json JSONB;
  v_items JSONB;
  v_count INT := 0;
BEGIN
  -- API 직접 호출
  SELECT content INTO v_response
  FROM http_get(
    'https://domeggook.com/ssl/api/?ver=1.0&mode=getCategoryList&aid=59a4d8f9efc963d6446f86615902e416&om=json&isReg=true'
  );

  v_json := v_response::JSONB;
  v_items := v_json->'domeggook'->'items';

  IF v_items IS NULL THEN
    RAISE EXCEPTION 'API 응답에서 items를 찾을 수 없습니다';
  END IF;

  -- 기존 데이터 삭제
  TRUNCATE dome_categories;

  -- 대분류 (depth 1)
  WITH l1 AS (
    SELECT value AS cat
    FROM jsonb_each(v_items) AS t(key, value)
    WHERE value->>'code' IS NOT NULL
  )
  INSERT INTO dome_categories (code, name, depth, parent_code, locked, jsonmart_category)
  SELECT
    cat->>'code',
    cat->>'name',
    1,
    NULL,
    COALESCE((cat->>'locked')::BOOLEAN, false),
    CASE SUBSTR(cat->>'code', 1, 2)
      WHEN '01' THEN 'FASHION'
      WHEN '02' THEN 'FASHION'
      WHEN '03' THEN 'DIGITAL'
      WHEN '04' THEN 'HOUSEHOLD'
      WHEN '05' THEN 'FOOD'
      WHEN '06' THEN 'SPORTS'
      WHEN '07' THEN 'BEAUTY'
      WHEN '08' THEN 'BABY'
      WHEN '09' THEN 'BABY'
      WHEN '10' THEN 'OFFICE'
      WHEN '11' THEN 'INTERIOR'
      WHEN '12' THEN 'HOUSEHOLD'
      WHEN '13' THEN 'KITCHEN'
      WHEN '14' THEN 'PETS'
      WHEN '15' THEN 'HEALTH'
      WHEN '16' THEN 'AUTOMOTIVE'
      WHEN '17' THEN 'MRO'
      WHEN '18' THEN 'CONSUMABLES'
      WHEN '19' THEN 'HYGIENE'
      WHEN '20' THEN 'TOYS'
      ELSE 'OTHER'
    END
  FROM l1
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, locked = EXCLUDED.locked;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '대분류 %개 삽입', v_count;

  -- 중분류 (depth 2)
  WITH l1 AS (
    SELECT value AS cat
    FROM jsonb_each(v_items) AS t(key, value)
    WHERE value->'child' IS NOT NULL
  ),
  l2 AS (
    SELECT l1.cat->>'code' AS p_code, c.value AS cat
    FROM l1, jsonb_each(l1.cat->'child') AS c(key, value)
    WHERE c.value->>'code' IS NOT NULL
  )
  INSERT INTO dome_categories (code, name, depth, parent_code, locked, jsonmart_category)
  SELECT
    l2.cat->>'code',
    l2.cat->>'name',
    2,
    l2.p_code,
    COALESCE((l2.cat->>'locked')::BOOLEAN, false),
    dc.jsonmart_category
  FROM l2
  LEFT JOIN dome_categories dc ON dc.code = l2.p_code
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, parent_code = EXCLUDED.parent_code, locked = EXCLUDED.locked;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '중분류 %개 삽입', v_count;

  -- 소분류 (depth 3)
  WITH l1 AS (
    SELECT value AS cat
    FROM jsonb_each(v_items) AS t(key, value)
    WHERE value->'child' IS NOT NULL
  ),
  l2 AS (
    SELECT c.value AS cat
    FROM l1, jsonb_each(l1.cat->'child') AS c(key, value)
    WHERE c.value->'child' IS NOT NULL
  ),
  l3 AS (
    SELECT l2.cat->>'code' AS p_code, c.value AS cat
    FROM l2, jsonb_each(l2.cat->'child') AS c(key, value)
    WHERE c.value->>'code' IS NOT NULL
  )
  INSERT INTO dome_categories (code, name, depth, parent_code, locked, jsonmart_category)
  SELECT
    l3.cat->>'code',
    l3.cat->>'name',
    3,
    l3.p_code,
    COALESCE((l3.cat->>'locked')::BOOLEAN, false),
    dc.jsonmart_category
  FROM l3
  LEFT JOIN dome_categories dc ON dc.code = l3.p_code
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, parent_code = EXCLUDED.parent_code, locked = EXCLUDED.locked;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '소분류 %개 삽입', v_count;

  -- 세분류 (depth 4)
  WITH l1 AS (
    SELECT value AS cat
    FROM jsonb_each(v_items) AS t(key, value)
    WHERE value->'child' IS NOT NULL
  ),
  l2 AS (
    SELECT c.value AS cat
    FROM l1, jsonb_each(l1.cat->'child') AS c(key, value)
    WHERE c.value->'child' IS NOT NULL
  ),
  l3 AS (
    SELECT c.value AS cat
    FROM l2, jsonb_each(l2.cat->'child') AS c(key, value)
    WHERE c.value->'child' IS NOT NULL
  ),
  l4 AS (
    SELECT l3.cat->>'code' AS p_code, c.value AS cat
    FROM l3, jsonb_each(l3.cat->'child') AS c(key, value)
    WHERE c.value->>'code' IS NOT NULL
  )
  INSERT INTO dome_categories (code, name, depth, parent_code, locked, jsonmart_category)
  SELECT
    l4.cat->>'code',
    l4.cat->>'name',
    4,
    l4.p_code,
    COALESCE((l4.cat->>'locked')::BOOLEAN, false),
    dc.jsonmart_category
  FROM l4
  LEFT JOIN dome_categories dc ON dc.code = l4.p_code
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, parent_code = EXCLUDED.parent_code, locked = EXCLUDED.locked;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '세분류 %개 삽입', v_count;

  -- 세세분류 (depth 5)
  WITH l1 AS (
    SELECT value AS cat
    FROM jsonb_each(v_items) AS t(key, value)
    WHERE value->'child' IS NOT NULL
  ),
  l2 AS (
    SELECT c.value AS cat
    FROM l1, jsonb_each(l1.cat->'child') AS c(key, value)
    WHERE c.value->'child' IS NOT NULL
  ),
  l3 AS (
    SELECT c.value AS cat
    FROM l2, jsonb_each(l2.cat->'child') AS c(key, value)
    WHERE c.value->'child' IS NOT NULL
  ),
  l4 AS (
    SELECT c.value AS cat
    FROM l3, jsonb_each(l3.cat->'child') AS c(key, value)
    WHERE c.value->'child' IS NOT NULL
  ),
  l5 AS (
    SELECT l4.cat->>'code' AS p_code, c.value AS cat
    FROM l4, jsonb_each(l4.cat->'child') AS c(key, value)
    WHERE c.value->>'code' IS NOT NULL
  )
  INSERT INTO dome_categories (code, name, depth, parent_code, locked, jsonmart_category)
  SELECT
    l5.cat->>'code',
    l5.cat->>'name',
    5,
    l5.p_code,
    COALESCE((l5.cat->>'locked')::BOOLEAN, false),
    dc.jsonmart_category
  FROM l5
  LEFT JOIN dome_categories dc ON dc.code = l5.p_code
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, parent_code = EXCLUDED.parent_code, locked = EXCLUDED.locked;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '세세분류 %개 삽입', v_count;

  -- 총 건수 반환
  SELECT COUNT(*) INTO v_count FROM dome_categories;
  RETURN v_count;
END;
$$;

-- 실행
SELECT load_dome_categories_from_api();

-- 결과 확인
SELECT depth, COUNT(*) AS cnt FROM dome_categories GROUP BY depth ORDER BY depth;
