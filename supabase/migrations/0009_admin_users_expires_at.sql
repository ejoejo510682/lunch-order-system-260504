-- admin_users 加 expires_at 欄位：可設定帳號自動失效日期
-- NULL = 永不過期（給長期帳號）
-- timestamptz = 該時間後登入會被拒絕

ALTER TABLE admin_users
  ADD COLUMN expires_at timestamptz NULL;

COMMENT ON COLUMN admin_users.expires_at IS '帳號失效時間。NULL 表示永不過期。';

CREATE INDEX idx_admin_users_expires_at ON admin_users(expires_at) WHERE expires_at IS NOT NULL;
