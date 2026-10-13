'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Megaphone } from 'lucide-react';

const PostDialog = dynamic(() => import('./PostDialog'), { ssr: false });

/** "Tạo bài đăng" on the listing page; the dialog's code loads on first click. */
export function PostButton({ id, disabled = false }: { id: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="a-btn a-btn-outline a-btn-sm" disabled={disabled} title={disabled ? 'Đăng căn để có link' : undefined} onClick={() => setOpen(true)}><Megaphone size={14} aria-hidden /> Tạo bài đăng</button>
      {open && <PostDialog id={id} onClose={() => setOpen(false)} />}
    </>
  );
}
