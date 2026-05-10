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
  const { error } = await supabase.from('daily_sessions').insert({
    order_date:    getTodayInTaipei(),
    vendor_id:     vendorId,
    kind,
    auto_close_at: autoClose ? buildTodayTimestamp(autoClose) : null,
    created_by:    admin.id,
  });

  if (error) {
    if (error.code === '23505') {
      return { error: `今日「${kind === 'food' ? '吃的' : '喝的'}」場次已存在` };
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
