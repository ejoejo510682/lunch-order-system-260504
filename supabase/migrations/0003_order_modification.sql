-- =====================================================
-- 訂餐系統 - 訂單修改追蹤 (新增需求 2026-05-07)
-- =====================================================
-- 情境：訂餐員打電話時餐廳缺貨，員工臨時改點
-- 需求：後台 admin / orderer 可修改已結單訂單的明細，並留下修改紀錄
-- =====================================================

ALTER TABLE order_items
  ADD COLUMN modified_at      timestamptz,
  ADD COLUMN modified_by      uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  ADD COLUMN modified_reason  text;

COMMENT ON COLUMN order_items.modified_at     IS '若不為 NULL 表示此明細被後台修改過';
COMMENT ON COLUMN order_items.modified_by     IS '修改者（admin_users.id），員工原始下單時為 NULL';
COMMENT ON COLUMN order_items.modified_reason IS '修改原因（必填，例：餐廳缺貨換咖哩飯）';


-- RLS 政策補充：admin / orderer 可修改 order_items
-- 原本 order_items 只有 admin 可讀的政策，現在加寫入權限

CREATE POLICY "admin_orderer_write_order_items" ON order_items
  FOR ALL TO authenticated
  USING (is_orderer_or_admin())
  WITH CHECK (is_orderer_or_admin());

-- orders 也要可改（修改明細時要重算 total_amount）

CREATE POLICY "admin_orderer_write_orders" ON orders
  FOR UPDATE TO authenticated
  USING (is_orderer_or_admin())
  WITH CHECK (is_orderer_or_admin());
