'use client';

import { useState, useTransition } from 'react';
import { Check } from 'lucide-react';
import { setMarketplace } from '@/lib/admin/postActions';

/** One-tap "Đã gỡ" / "Đã làm mới" on Hôm nay. Optimistic; rolls back on error. */
export function MarketplaceDone({ id, action }: { id: string; action: 'removed' | 'renewed' }) {
  const [state, setState] = useState<'idle' | 'done' | 'error'>('idle');
  const [, start] = useTransition();
  const label = action === 'removed' ? 'Đã gỡ' : 'Đã làm mới';
  return (
    <button type="button" className={`a-btn a-btn-sm ${state === 'done' ? 'a-btn-ghost' : 'a-btn-outline'}`} disabled={state === 'done'}
      onClick={() => { setState('done'); start(async () => { if ((await setMarketplace(id, action)).error) setState('error'); }); }}>
      {state === 'done' ? <><Check size={14} aria-hidden /> {label}</> : state === 'error' ? 'Lỗi · thử lại' : label}
    </button>
  );
}
