-- =====================================================
-- 訂餐系統 - 初始 Schema (Phase 1)
-- =====================================================
-- 在 Supabase Dashboard → SQL Editor 中貼上整份檔案執行。
-- 重複執行會失敗（CREATE TYPE / CREATE TABLE 不是 IF NOT EXISTS），
-- 如需重來請先在 SQL Editor 執行 DROP（見檔尾註解）。
-- =====================================================


-- ---------- ENUM 型別 ----------

CREATE TYPE session_status AS ENUM ('open', 'closed');
CREATE TYPE order_status   AS ENUM ('submitted', 'cancelled');
CREATE TYPE admin_role     AS ENUM ('admin', 'orderer', 'accountant');


-- ---------- 1. vendors（廠商）----------

CREATE TABLE vendors (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  phone       text,
  note        text,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_vendors_is_active ON vendors(is_active);


-- ---------- 2. menu_items（菜單品項）----------

CREATE TABLE menu_items (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id   uuid        NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  price       integer     NOT NULL CHECK (price >= 0),
  is_active   boolean     NOT NULL DEFAULT true,
  sort_order  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_menu_items_vendor      ON menu_items(vendor_id);
CREATE INDEX idx_menu_items_vendor_sort ON menu_items(vendor_id, sort_order);


-- ---------- 3. employees（員工，無 is_active）----------

CREATE TABLE employees (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text        NOT NULL,
  line_user_id  text        UNIQUE,
  created_at    timestamptz NOT NULL DEFAULT now()
);


-- ---------- 7. admin_users（後台使用者，先建好給 daily_sessions FK 用）----------

CREATE TABLE admin_users (
  id          uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       text        NOT NULL,
  name        text        NOT NULL,
  role        admin_role  NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);


-- ---------- 4. daily_sessions（每日訂餐場次）----------

CREATE TABLE daily_sessions (
  id              uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  order_date      date           NOT NULL,
  vendor_id       uuid           NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
  status          session_status NOT NULL DEFAULT 'open',
  auto_close_at   timestamptz,
  closed_at       timestamptz,
  created_by      uuid           REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at      timestamptz    NOT NULL DEFAULT now(),
  UNIQUE (order_date)
);

CREATE INDEX idx_daily_sessions_status_close
  ON daily_sessions(status, auto_close_at)
  WHERE status = 'open' AND auto_close_at IS NOT NULL;


-- ---------- 5. orders（訂單主表，含 employee_name 快照）----------

CREATE TABLE orders (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid         NOT NULL REFERENCES daily_sessions(id) ON DELETE RESTRICT,
  employee_id     uuid         REFERENCES employees(id) ON DELETE SET NULL,
  employee_name   text         NOT NULL,
  total_amount    integer      NOT NULL CHECK (total_amount >= 0),
  status          order_status NOT NULL DEFAULT 'submitted',
  submitted_at    timestamptz  NOT NULL DEFAULT now(),
  editable_until  timestamptz  NOT NULL,
  created_at      timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_session     ON orders(session_id);
CREATE INDEX idx_orders_employee    ON orders(employee_id);
CREATE INDEX idx_orders_session_emp ON orders(session_id, employee_id);


-- ---------- 6. order_items（訂單明細，含 item_name / item_price 快照）----------

CREATE TABLE order_items (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      uuid        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id  uuid        REFERENCES menu_items(id) ON DELETE SET NULL,
  item_name     text        NOT NULL,
  item_price    integer     NOT NULL CHECK (item_price >= 0),
  quantity      integer     NOT NULL CHECK (quantity > 0),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_items_order ON order_items(order_id);


-- =====================================================
-- 重置用（如需重跑，先執行這段）
-- =====================================================
-- DROP TABLE IF EXISTS order_items     CASCADE;
-- DROP TABLE IF EXISTS orders          CASCADE;
-- DROP TABLE IF EXISTS daily_sessions  CASCADE;
-- DROP TABLE IF EXISTS admin_users     CASCADE;
-- DROP TABLE IF EXISTS employees       CASCADE;
-- DROP TABLE IF EXISTS menu_items      CASCADE;
-- DROP TABLE IF EXISTS vendors         CASCADE;
-- DROP TYPE  IF EXISTS admin_role;
-- DROP TYPE  IF EXISTS order_status;
-- DROP TYPE  IF EXISTS session_status;
