-- ============================================
-- FIX: Infinite Recursion in user_roles RLS
-- Run this in Supabase SQL Editor
-- ============================================

-- Problem: Policies on products/agent_policies do
--   EXISTS (SELECT 1 FROM user_roles WHERE ...)
-- which triggers user_roles RLS, which also queries user_roles → infinite loop

-- Fix: Use is_admin() function (SECURITY DEFINER, bypasses RLS) instead

-- Step 1: Drop the recursive policy on user_roles
DROP POLICY IF EXISTS "Admin manage roles" ON user_roles;

-- Step 2: Recreate user_roles policies without recursion
-- Keep the simple "read own role" policy (no recursion since it only checks auth.uid())
-- "Users read own role" already exists and is safe

-- Step 3: Fix products policies to use is_admin()
DROP POLICY IF EXISTS "Admin insert products" ON products;
DROP POLICY IF EXISTS "Admin update products" ON products;
DROP POLICY IF EXISTS "Admin delete products" ON products;

CREATE POLICY "Admin insert products" ON products
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "Admin update products" ON products
  FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Admin delete products" ON products
  FOR DELETE USING (is_admin());

-- Step 4: Fix agent_policies policies to use is_admin()
DROP POLICY IF EXISTS "Admin insert agent_policies" ON agent_policies;
DROP POLICY IF EXISTS "Admin update agent_policies" ON agent_policies;
DROP POLICY IF EXISTS "Admin delete agent_policies" ON agent_policies;

CREATE POLICY "Admin insert agent_policies" ON agent_policies
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "Admin update agent_policies" ON agent_policies
  FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Admin delete agent_policies" ON agent_policies
  FOR DELETE USING (is_admin());
