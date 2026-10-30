'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { buildingRefs, trashBuilding } from '@/lib/admin/trashActions';
import { ConfirmDialog } from './Danger';

/** "Xoá toà nhà" menu item: refused while one of its unit types is on the website; otherwise typed-name confirm. */
export function BuildingDelete({ id, name }: { id: string; name: string }) {
  const [refs, setRefs] = useState<{ visible: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState('');
  const [busy, start] = useTransition();
  const router = useRouter();
  const blocked = !!refs && refs.visible > 0;
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
          <>Toà nhà còn <b>{refs!.visible} loại căn</b> đang hiển thị trên website.
            Ẩn các loại căn đó trước. <Link href={`/admin/loai-can?b=${id}`}>Mở Loại căn →</Link></>
        ) : (
          <>Toà nhà gỡ khỏi website và nằm trong Thùng rác 30 ngày. Tiền tố mã của toà được giữ riêng, không bao giờ cấp lại.</>
        )}
      </ConfirmDialog>
    </>
  );
}
