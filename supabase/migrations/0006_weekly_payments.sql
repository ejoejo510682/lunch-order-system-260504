-- =====================================================
-- 訂餐系統 - 週結付款紀錄 (2026-05-10)
-- =====================================================
-- 新增需求：訂餐員每週五標記員工是否已付清當週餐費，員工可在 LIFF 看到狀態。
-- =====================================================

CREATE TABLE weekly_payments (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     uuid        REFERENCES employees(id) ON DELETE SET NULL,
  employee_name   text        NOT NULL,
  week_start      date        NOT NULL,
  amount          integer     NOT NULL CHECK (amount >= 0),
  paid_at         timestamptz NOT NULL DEFAULT now(),
  paid_by         uuid        REFERENCES admin_users(id) ON DELETE SET NULL,
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- 同一員工同一週只能一筆紀錄（員工被刪後 employee_id=NULL 時不限制）
CREATE UNIQUE INDEX idx_weekly_payments_unique
  ON weekly_payments(employee_id, week_start)
  WHERE employee_id IS NOT NULL;

CREATE INDEX idx_weekly_payments_week ON weekly_payments(week_start);


-- ---------- RLS ----------

ALTER TABLE weekly_payments ENABLE ROW LEVEL SECURITY;

-- 三角色都可讀（accountant 之後 Phase 5 報表用）
CREATE POLICY "admin_orderer_accountant_read_payments" ON weekly_payments
  FOR SELECT TO authenticated
  USING (is_any_admin_user());

-- 寫入只給 admin + orderer（依使用者選擇）
CREATE POLICY "admin_orderer_write_payments" ON weekly_payments
  FOR INSERT TO authenticated
  WITH CHECK (is_orderer_or_admin());

CREATE POLICY "admin_orderer_update_payments" ON weekly_payments
  FOR UPDATE TO authenticated
  USING (is_orderer_or_admin())
  WITH CHECK (is_orderer_or_admin());

CREATE POLICY "admin_orderer_delete_payments" ON weekly_payments
  FOR DELETE TO authenticated
  USING (is_orderer_or_admin());
