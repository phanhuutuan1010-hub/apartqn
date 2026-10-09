'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { buildingRefs, trashBuilding } from '@/lib/admin/trashActions';
import { ConfirmDialog } from './Danger';

/** "Xoá toà nhà" menu item: refused while any unit / listing points at it (trash included); otherwise typed-name confirm. */
export function BuildingDelete({ id, name, slug }: { id: string; name: string; slug: string }) {
  const [refs, setRefs] = useState<{ units: number; listings: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState('');
  const [busy, start] = useTransition();
  const router = useRouter();
  const blocked = !!refs && refs.units > 0;
  return (
    <>
      <button type="button" role="menuitem" className="danger"
        onClick={(e) => {
          (e.currentTarget.closest('details') as HTMLDetailsElement | null)?.removeAttribute('open');
          setErr(''); setRefs(null); setOpen(true);
          start(async () => setRefs(await buildingRefs(id)));
        }}>Xoá toà nhà</button>
      <ConfirmDialog open={open && !!refs} title={blocked ? 'Chưa xoá được toà nhà' : `Xoá ${name}?`} confirmLabel="Xoá toà nhà" busy={busy} error={err}
        typed={blocked ? undefined : name} typedLabel="Nhập tên toà nhà"
        onClose={() => setOpen(false)}
        onConfirm={() => blocked ? setOpen(false) : start(async () => {
          const r = await trashBuilding(id, name);
          if (r.error) return setErr(r.error);
          router.push('/admin/toa-nha');
        })}>
        {blocked ? (
          <>Toà nhà còn <b>{refs!.listings} tin</b>{refs!.units > refs!.listings ? <> và {refs!.units - refs!.listings} căn chưa có tin</> : null} (kể cả trong Thùng rác).
            Xoá hoặc chuyển các căn đó trước. <Link href={`/admin/can-ho?b=${slug}`}>Xem các căn của toà →</Link></>
        ) : (
          <>Toà nhà gỡ khỏi website và nằm trong Thùng rác 30 ngày. Tiền tố mã căn của toà được giữ riêng, không bao giờ cấp lại.</>
        )}
      </ConfirmDialog>
    </>
  );
}
