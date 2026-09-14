-- 效能優化：後台驗證身份原本要先打一次 getUser() 問「這是誰」，再查 admin_users「角色是什麼」，
-- 兩趟網路來回拖慢每次換頁的速度。
--
-- 原本想直接查 admin_users 靠 RLS 自動限制成只回傳自己那一筆，但 admin_users 上還有一條
-- admin_read_all policy（is_admin() 為真時可讀全部人），兩條 policy 是「或」的關係，
-- 導致 role = admin 的帳號一查就拿回所有人、不是預期的單一列。改用這個函式明確用
-- auth.uid() 篩出「我自己」這一筆，跟既有的 current_admin_role() 是同一種寫法，
-- 純粹新增、不改動任何現有資料表或權限規則。
create or replace function public.current_admin_profile()
returns table (id uuid, email text, name text, role admin_role, expires_at timestamptz)
language sql security definer stable set search_path = public as $$
  select id, email, name, role, expires_at from admin_users where id = auth.uid();
$$;
