-- ============================================
-- Admin Role System + RLS Hardening
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Create user_roles table
CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on user_roles
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- RLS: users can read their own role, admin can read all
CREATE POLICY "Users read own role" ON user_roles
  FOR SELECT USING (user_id = auth.uid());

-- Only admin can manage roles (prevent privilege escalation)
CREATE POLICY "Admin manage roles" ON user_roles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- 2. Register the owner as admin
INSERT INTO user_roles (user_id, role)
VALUES ('6e5e8015-0415-495c-9f4c-36e0af9a5d46', 'admin')
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';

-- 3. Harden products RLS: only admin can INSERT/UPDATE/DELETE
-- First drop existing permissive policies
DROP POLICY IF EXISTS "Authenticated manage products" ON products;
DROP POLICY IF EXISTS "Authenticated update products" ON products;
DROP POLICY IF EXISTS "Authenticated delete products" ON products;

-- Create admin-only policies
CREATE POLICY "Admin insert products" ON products
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Admin update products" ON products
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Admin delete products" ON products
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- 4. Harden other admin tables
-- agent_policies: admin only for write
DROP POLICY IF EXISTS "Users manage own policies" ON agent_policies;
DROP POLICY IF EXISTS "Users update own policies" ON agent_policies;
DROP POLICY IF EXISTS "Users delete own policies" ON agent_policies;

CREATE POLICY "Admin insert agent_policies" ON agent_policies
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Admin update agent_policies" ON agent_policies
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Admin delete agent_policies" ON agent_policies
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- 5. Helper function: check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

-- 6. RPC to get current user's role (for frontend)
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM user_roles WHERE user_id = auth.uid();
  RETURN COALESCE(v_role, 'viewer');
END;
$$;

GRANT EXECUTE ON FUNCTION get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;

-- 7. Update Domeggook proxy functions to require admin
CREATE OR REPLACE FUNCTION domeggook_search(
  p_keyword TEXT,
  p_page INTEGER DEFAULT 1,
  p_size INTEGER DEFAULT 20
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_url TEXT;
  v_response http_response;
BEGIN
  -- Admin check
  IF NOT is_admin() THEN
    RETURN jsonb_build_object('error', 'ADMIN_REQUIRED', 'message', 'Admin access required');
  END IF;

  v_url := 'https://domeggook.com/ssl/api/?ver=4.1&mode=getItemList'
    || '&aid=59a4d8f9efc963d6446f86615902e416'
    || '&market=dome&om=json'
    || '&sz=' || p_size::TEXT
    || '&pg=' || p_page::TEXT
    || '&kw=' || urlencode(p_keyword);

  SELECT * INTO v_response FROM http_get(v_url);

  IF v_response.status = 200 THEN
    RETURN v_response.content::JSONB;
  ELSE
    RETURN jsonb_build_object('error', 'API_ERROR', 'status', v_response.status);
  END IF;

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', 'REQUEST_FAILED', 'message', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION domeggook_detail(p_item_no TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_url TEXT;
  v_response http_response;
BEGIN
  -- Admin check
  IF NOT is_admin() THEN
    RETURN jsonb_build_object('error', 'ADMIN_REQUIRED', 'message', 'Admin access required');
  END IF;

  v_url := 'https://domeggook.com/ssl/api/?ver=4.5&mode=getItemView'
    || '&aid=59a4d8f9efc963d6446f86615902e416'
    || '&no=' || p_item_no
    || '&om=json';

  SELECT * INTO v_response FROM http_get(v_url);

  IF v_response.status = 200 THEN
    RETURN v_response.content::JSONB;
  ELSE
    RETURN jsonb_build_object('error', 'API_ERROR', 'status', v_response.status);
  END IF;

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', 'REQUEST_FAILED', 'message', SQLERRM);
END;
$$;
