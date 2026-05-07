-- =====================================================
-- 訂餐系統 - RLS 政策 (Phase 1)
-- =====================================================
-- 在 0001_initial_schema.sql 執行成功後再跑這份。
-- =====================================================


-- ---------- Helper：查詢當前登入後台帳號的 role ----------

CREATE OR REPLACE FUNCTION public.current_admin_role()
RETURNS admin_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM admin_users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT current_admin_role() = 'admin'::admin_role;
$$;

CREATE OR REPLACE FUNCTION public.is_orderer_or_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT current_admin_role() IN ('admin'::admin_role, 'orderer'::admin_role);
$$;

CREATE OR REPLACE FUNCTION public.is_accountant_or_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT current_admin_role() IN ('admin'::admin_role, 'accountant'::admin_role);
$$;

CREATE OR REPLACE FUNCTION public.is_any_admin_user() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid());
$$;


-- ---------- 啟用 RLS ----------

ALTER TABLE vendors        ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees      ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders         ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users    ENABLE ROW LEVEL SECURITY;


-- =====================================================
-- vendors（廠商）
-- =====================================================

-- 員工端 LIFF（anon）只能讀啟用中的廠商
CREATE POLICY "anon_read_active_vendors" ON vendors
  FOR SELECT TO anon
  USING (is_active = true);

-- 任何登入的後台帳號都能讀
CREATE POLICY "admin_read_vendors" ON vendors
  FOR SELECT TO authenticated
  USING (is_any_admin_user());

-- admin / orderer 可寫入
CREATE POLICY "admin_orderer_write_vendors" ON vendors
  FOR ALL TO authenticated
  USING (is_orderer_or_admin())
  WITH CHECK (is_orderer_or_admin());


-- =====================================================
-- menu_items（菜單品項）
-- =====================================================

CREATE POLICY "anon_read_active_menu_items" ON menu_items
  FOR SELECT TO anon
  USING (is_active = true);

CREATE POLICY "admin_read_menu_items" ON menu_items
  FOR SELECT TO authenticated
  USING (is_any_admin_user());

CREATE POLICY "admin_orderer_write_menu_items" ON menu_items
  FOR ALL TO authenticated
  USING (is_orderer_or_admin())
  WITH CHECK (is_orderer_or_admin());


-- =====================================================
-- employees（員工）
-- =====================================================

-- 員工端 LIFF（anon）可讀全部員工（用來下拉選身份）
CREATE POLICY "anon_read_employees" ON employees
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "admin_read_employees" ON employees
  FOR SELECT TO authenticated
  USING (is_any_admin_user());

-- 只有 admin 可新增、修改、刪除員工
CREATE POLICY "admin_write_employees" ON employees
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());


-- =====================================================
-- daily_sessions（每日場次）
-- =====================================================

-- 員工端 LIFF 可讀今日場次（看開單狀態與當日廠商）
CREATE POLICY "anon_read_daily_sessions" ON daily_sessions
  FOR SELECT TO anon
  USING (order_date = (now() AT TIME ZONE 'Asia/Taipei')::date);

CREATE POLICY "admin_read_daily_sessions" ON daily_sessions
  FOR SELECT TO authenticated
  USING (is_any_admin_user());

CREATE POLICY "admin_orderer_write_daily_sessions" ON daily_sessions
  FOR ALL TO authenticated
  USING (is_orderer_or_admin())
  WITH CHECK (is_orderer_or_admin());


-- =====================================================
-- orders（訂單主表）
-- =====================================================
-- 員工端 LIFF 不直接讀寫 orders，全部走後端 API（service_role）
-- 後台 admin / orderer 可讀；accountant 結算用 → 也可讀
-- 沒人從前端直接寫 orders，寫入只透過 service_role API

CREATE POLICY "admin_read_orders" ON orders
  FOR SELECT TO authenticated
  USING (is_any_admin_user());


-- =====================================================
-- order_items（訂單明細）
-- =====================================================

CREATE POLICY "admin_read_order_items" ON order_items
  FOR SELECT TO authenticated
  USING (is_any_admin_user());


-- =====================================================
-- admin_users（後台帳號）
-- =====================================================

-- 任何已登入後台的帳號可看自己的資料（layout 取角色用）
CREATE POLICY "admin_read_self" ON admin_users
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- admin 可看全部後台帳號
CREATE POLICY "admin_read_all" ON admin_users
  FOR SELECT TO authenticated
  USING (is_admin());

-- admin 可新增 / 修改 / 刪除後台帳號
CREATE POLICY "admin_write_admin_users" ON admin_users
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());


-- =====================================================
-- 重置用（如需重跑 RLS 政策）
-- =====================================================
-- DROP FUNCTION IF EXISTS public.current_admin_role()      CASCADE;
-- DROP FUNCTION IF EXISTS public.is_admin()                CASCADE;
-- DROP FUNCTION IF EXISTS public.is_orderer_or_admin()     CASCADE;
-- DROP FUNCTION IF EXISTS public.is_accountant_or_admin()  CASCADE;
-- DROP FUNCTION IF EXISTS public.is_any_admin_user()       CASCADE;
