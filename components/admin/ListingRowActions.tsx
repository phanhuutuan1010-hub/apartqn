'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { changeStatus, confirmAvailable } from '@/lib/admin/listingActions';
import { STATUS_LABEL, type ListingStatusAll } from '@/lib/admin/labels';

/** Statuses the current user may pick from the given one (mirrors the DB guard; the DB still decides). */
export function allowedStatuses(from: ListingStatusAll, role: 'admin' | 'sales', canPublish: boolean): ListingStatusAll[] {
  if (role === 'admin') return ['draft', 'pending', 'available', 'reserved', 'rented', 'hidden'];
  const pub: ListingStatusAll[] = ['available', 'reserved', 'rented'];
  if (pub.includes(from)) return [...pub, 'hidden'];
  if (from === 'pending') return ['pending', 'draft'];
  if (from === 'hidden') return canPublish ? ['hidden', 'draft', ...pub] : ['hidden', 'draft'];
  return [from];
}

export function ListingRowActions({ id, status, role, canPublish }: { id: string; status: ListingStatusAll; role: 'admin' | 'sales'; canPublish: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ t: 'ok' | 'error'; m: string } | null>(null);
  const options = allowedStatuses(status, role, canPublish);

  const run = (fn: () => Promise<{ ok?: string; error?: string }>) =>
    start(async () => {
      const r = await fn();
      setMsg(r.error ? { t: 'error', m: r.error } : { t: 'ok', m: r.ok ?? '' });
      router.refresh();
    });

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
      {options.length > 1 && (
        <select
          aria-label="Đổi trạng thái"
          className="input"
          style={{ height: 32, fontSize: 13, width: 'auto', padding: '0 28px 0 8px', backgroundPosition: 'right 8px center' }}
          value={status}
          disabled={pending}
          onChange={(e) => {
            const s = e.target.value as ListingStatusAll;
            if (s === 'hidden' && !confirm('Ẩn căn này khỏi website?')) return;
            run(() => changeStatus(id, s));
          }}
        >
          {options.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
      )}
      {(status === 'available' || status === 'reserved') && (
        <button type="button" className="a-btn a-btn-ghost a-btn-sm" disabled={pending} onClick={() => run(() => confirmAvailable(id))} title="Xác nhận căn vẫn còn trống hôm nay">
          ✓ Còn trống
        </button>
      )}
      {msg && <span className="a-small" style={{ color: msg.t === 'error' ? 'var(--error)' : 'var(--ok-fg)', flexBasis: '100%', textAlign: 'right' }} role="status">{msg.m}</span>}
    </div>
  );
}
