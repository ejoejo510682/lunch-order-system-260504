-- =====================================================
-- 訂餐系統 - 廠商分類（吃的／喝的）+ 場次取消 (2026-05-07)
-- =====================================================
-- 1. vendors / daily_sessions 加上 kind（食物 / 飲料）
-- 2. daily_sessions 改為每天「每類別」一條（吃的 + 喝的可同時開）
-- 3. session 可以被取消（status=cancelled），含取消時間與原因
-- 4. trigger 確保 session.kind 與 vendor.kind 一致
-- =====================================================


-- ---------- 1. vendor_kind enum ----------

CREATE TYPE vendor_kind AS ENUM ('food', 'drink');


-- ---------- 2. vendors 加 kind ----------

ALTER TABLE vendors
  ADD COLUMN kind vendor_kind NOT NULL DEFAULT 'food';


-- ---------- 3. session_status 加 'cancelled' ----------

ALTER TYPE session_status ADD VALUE IF NOT EXISTS 'cancelled';


-- ---------- 4. daily_sessions 加欄位、改唯一鍵 ----------

ALTER TABLE daily_sessions
  ADD COLUMN kind vendor_kind NOT NULL DEFAULT 'food',
  ADD COLUMN cancelled_at        timestamptz,
  ADD COLUMN cancelled_by        uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  ADD COLUMN cancellation_reason text;

-- 移除舊的「每天只能一條」UNIQUE，改為「每天每類別一條」
ALTER TABLE daily_sessions
  DROP CONSTRAINT daily_sessions_order_date_key;

ALTER TABLE daily_sessions
  ADD CONSTRAINT daily_sessions_date_kind_unique UNIQUE (order_date, kind);


-- ---------- 5. trigger：強制 session.kind 與 vendor.kind 相同 ----------

CREATE OR REPLACE FUNCTION enforce_session_vendor_kind_match()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_kind vendor_kind;
BEGIN
  SELECT kind INTO v_kind FROM vendors WHERE id = NEW.vendor_id;
  IF v_kind IS NULL THEN
    RAISE EXCEPTION '指定的廠商不存在';
  END IF;
  IF v_kind <> NEW.kind THEN
    RAISE EXCEPTION '場次類別（%）與廠商類別（%）不符', NEW.kind, v_kind;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER daily_sessions_kind_match_check
  BEFORE INSERT OR UPDATE OF vendor_id, kind ON daily_sessions
  FOR EACH ROW
  EXECUTE FUNCTION enforce_session_vendor_kind_match();


-- ---------- 6. RLS 政策補強：cancelled_* 欄位的更新權限已被 0003 的 admin_orderer_write_orders 涵蓋
-- ---------- daily_sessions 的取消權限延用 0002 的 admin_orderer_write_daily_sessions
