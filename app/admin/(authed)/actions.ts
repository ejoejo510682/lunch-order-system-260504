'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/getCurrentAdmin';
import { getTodayInTaipei, buildTodayTimestamp } from '@/lib/date';

export interface SessionActionState {
  error?: string;
  success?: boolean;
}

const PATH = '/admin';

const ALLOWED_TIMES = ['10:00', '10:30', '11:00'] as const;
type AllowedTime = typeof ALLOWED_TIMES[number] | '';

function parseKind(value: unknown): 'food' | 'drink' | null {
  return value === 'food' || value === 'drink' ? value : null;
}

function parseAutoClose(value: unknown): AllowedTime | null {
  const s = String(value ?? '');
  if (s === '') return '';
  if ((ALLOWED_TIMES as readonly string[]).includes(s)) return s as AllowedTime;
  return null;
}

export async function openSession(
  _prev: SessionActionState,
  formData: FormData,
): Promise<SessionActionState> {
  const admin = await requireRole(['admin', 'orderer']);

  const kind       = parseKind(formData.get('kind'));
  const vendorId   = String(formData.get('vendor_id') ?? '');
  const autoClose  = parseAutoClose(formData.get('auto_close'));

  if (!kind)            return { error: '無效的分類' };
  if (!vendorId)        return { error: '請選擇廠商' };
  if (autoClose === null) return { error: '無效的自動結單時間' };

  const supabase = await createClient();
  const today = getTodayInTaipei();

  // 嘗試先刪除同日同類別的「已取消」場次（若還有訂單會被 FK 擋下，下面 INSERT 也會 23505 失敗）
  await supabase
    .from('daily_sessions')
    .delete()
    .eq('order_date', today)
    .eq('kind', kind)
    .eq('status', 'cancelled');

  const { error } = await supabase.from('daily_sessions').insert({
    order_date:    today,
    vendor_id:     vendorId,
    kind,
    auto_close_at: autoClose ? buildTodayTimestamp(autoClose) : null,
    created_by:    admin.id,
  });

  if (error) {
    if (error.code === '23505') {
      return { error: `今日「${kind === 'food' ? '吃的' : '喝的'}」場次已存在（取消的場次仍有訂單未處理）` };
    }
    return { error: `開單失敗：${error.message}` };
  }

  revalidatePath(PATH);
  return { success: true };
}

export async function closeSession(sessionId: string) {
  await requireRole(['admin', 'orderer']);

  const supabase = await createClient();
  const { error } = await supabase
    .from('daily_sessions')
    .update({
      status:    'closed',
      closed_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .eq('status', 'open');

  if (error) throw new Error(`結單失敗：${error.message}`);

  revalidatePath(PATH);
}

export async function changeSessionVendor(input: {
  sessionId: string;
  newVendorId: string;
}): Promise<{ ok: boolean; error?: string }> {
  await requireRole(['admin', 'orderer']);
  const { sessionId, newVendorId } = input;

  if (!sessionId) return { ok: false, error: '無效的場次' };
  if (!newVendorId) return { ok: false, error: '請選擇新廠商' };

  const supabase = await createClient();

  // 1. 撈場次狀態
  const { data: session } = await supabase
    .from('daily_sessions')
    .select('id, status, kind, vendor_id')
    .eq('id', sessionId)
    .maybeSingle();

  if (!session) return { ok: false, error: '場次不存在' };
  if (session.status !== 'open') return { ok: false, error: '只有「進行中」的場次才能改廠商' };
  if (session.vendor_id === newVendorId) return { ok: false, error: '新廠商與目前廠商相同' };

  // 2. 確認沒有有效訂單
  const { count, error: countErr } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', sessionId)
    .eq('status', 'submitted');
  if (countErr) return { ok: false, error: `檢查訂單失敗：${countErr.message}` };
  if ((count ?? 0) > 0) {
    return { ok: false, error: '此場次已有員工點餐，無法直接改廠商。請先「取消整場」再重新開單。' };
  }

  // 3. 確認新廠商存在、啟用、且同類別
  const { data: vendor } = await supabase
    .from('vendors')
    .select('id, kind, is_active')
    .eq('id', newVendorId)
    .maybeSingle();
  if (!vendor) return { ok: false, error: '新廠商不存在' };
  if (!vendor.is_active) return { ok: false, error: '新廠商已停用' };
  if (vendor.kind !== session.kind) {
    return { ok: false, error: `新廠商分類不符（場次是${session.kind === 'food' ? '吃的' : '喝的'}）` };
  }

  // 4. 更新
  const { error: updateErr } = await supabase
    .from('daily_sessions')
    .update({ vendor_id: newVendorId })
    .eq('id', sessionId);
  if (updateErr) return { ok: false, error: `更新失敗：${updateErr.message}` };

  revalidatePath(PATH);
  revalidatePath(`/admin/sessions/${sessionId}`);
  return { ok: true };
}

export async function cancelSession(
  _prev: SessionActionState,
  formData: FormData,
): Promise<SessionActionState> {
  const admin     = await requireRole(['admin', 'orderer']);
  const sessionId = String(formData.get('session_id') ?? '');
  const reason    = String(formData.get('reason') ?? '').trim();

  if (!sessionId) return { error: '無效的場次' };
  if (!reason)    return { error: '請填寫取消原因' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('daily_sessions')
    .update({
      status:              'cancelled',
      cancelled_at:        new Date().toISOString(),
      cancelled_by:        admin.id,
      cancellation_reason: reason,
    })
    .eq('id', sessionId)
    .neq('status', 'cancelled');

  if (error) return { error: `取消失敗：${error.message}` };

  revalidatePath(PATH);
  return { success: true };
}
