'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/getCurrentAdmin';

export interface MarkPaidResult {
  ok: boolean;
  error?: string;
}

export interface MarkPaidInput {
  employeeId: string;
  weekStart: string; // YYYY-MM-DD (週一)
  amount: number;
  note?: string;
}

export async function markPaid(input: MarkPaidInput): Promise<MarkPaidResult> {
  const admin = await requireRole(['admin', 'orderer']);

  const { employeeId, weekStart, amount, note } = input;
  if (!employeeId || !weekStart) return { ok: false, error: '參數缺失' };
  if (!Number.isInteger(amount) || amount < 0) return { ok: false, error: '金額不正確' };

  const supabase = await createClient();

  // 撈員工姓名做快照
  const { data: employee } = await supabase
    .from('employees')
    .select('name')
    .eq('id', employeeId)
    .maybeSingle();

  if (!employee) return { ok: false, error: '員工不存在' };

  const { error } = await supabase.from('weekly_payments').insert({
    employee_id:   employeeId,
    employee_name: employee.name,
    week_start:    weekStart,
    amount,
    paid_by:       admin.id,
    note:          note || null,
  });

  if (error) {
    if (error.code === '23505') {
      return { ok: false, error: '此員工本週已標記付款' };
    }
    return { ok: false, error: `標記失敗：${error.message}` };
  }

  revalidatePath('/admin/settlements');
  return { ok: true };
}

export async function unmarkPaid(paymentId: string): Promise<MarkPaidResult> {
  await requireRole(['admin', 'orderer']);
  if (!paymentId) return { ok: false, error: '參數缺失' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('weekly_payments')
    .delete()
    .eq('id', paymentId);

  if (error) return { ok: false, error: `取消標記失敗：${error.message}` };

  revalidatePath('/admin/settlements');
  return { ok: true };
}
