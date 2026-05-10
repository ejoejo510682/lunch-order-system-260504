-- =====================================================
-- 訂餐系統 - 啟用 Realtime 即時推播 (Phase 2.5)
-- =====================================================
-- 後台「今日總覽」需要在員工下單時即時更新統計，
-- 以及 Cron 自動結單後立刻反映狀態。
-- =====================================================

ALTER PUBLICATION supabase_realtime ADD TABLE daily_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
