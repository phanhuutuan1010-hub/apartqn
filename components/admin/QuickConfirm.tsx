'use client';

import { useState, useTransition } from 'react';
import { Check } from 'lucide-react';
import { confirmAvailable } from '@/lib/admin/listingActions';

/** "✓ Còn trống" in one tap (Hôm nay). Optimistic: shows done at once, rolls back on error. */
export function QuickConfirm({ id }: { id: string }) {
  const [state, setState] = useState<'idle' | 'done' | 'error'>('idle');
  const [, start] = useTransition();
  return (
    <button
      type="button"
      className={`a-btn a-btn-sm ${state === 'done' ? 'a-btn-ghost' : 'a-btn-outline'}`}
      disabled={state === 'done'}
      title={state === 'error' ? 'Không lưu được — thử lại' : 'Xác nhận căn vẫn còn trống hôm nay'}
      onClick={() => {
        setState('done');
        start(async () => {
          const r = await confirmAvailable(id);
          if (r.error) setState('error');
        });
      }}
    >
      {state === 'done' ? <><Check size={14} aria-hidden /> Đã xác nhận</> : state === 'error' ? 'Lỗi · thử lại' : '✓ Còn trống'}
    </button>
  );
}
