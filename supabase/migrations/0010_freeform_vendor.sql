-- =====================================================
-- 訂餐系統 - 自由填寫廠商（例如 foodpanda 代點）(2026-11-11)
-- =====================================================
-- 情境：直接用 foodpanda 點餐、手機交給大家選，沒有固定菜單可以選。
-- 需求：開單時可以選「自由填寫」廠商，訂餐員順便填當天實際訂的餐廳名稱，
--       員工端點餐時改成填空白表單（品項/數量/單價），不是從固定菜單選。
-- =====================================================

ALTER TABLE vendors
  ADD COLUMN allow_freeform boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN vendors.allow_freeform IS 'true=不使用固定菜單，LIFF 點餐改顯示空白表單讓員工自行填寫品項/數量/單價';

ALTER TABLE daily_sessions
  ADD COLUMN freeform_restaurant_name text;

COMMENT ON COLUMN daily_sessions.freeform_restaurant_name IS '僅自由填寫廠商的場次使用：開單時訂餐員填的當天實際餐廳名稱（例：foodpanda - 麥當勞）';
