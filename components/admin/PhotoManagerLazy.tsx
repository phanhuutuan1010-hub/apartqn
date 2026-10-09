'use client';

import dynamic from 'next/dynamic';
import type { PhotoOwner } from '@/lib/admin/photoPipeline';
import type { PhotoView } from './PhotoManager';

/** Photos sit below the main fields: their code (upload queue, menus) loads after the page is interactive. */
const PhotoManager = dynamic(() => import('./PhotoManager').then((m) => m.PhotoManager), {
  loading: () => <p className="a-small a-muted">Đang tải ảnh…</p>,
});

export function PhotoManagerLazy(props: { owner: PhotoOwner; photos: PhotoView[] }) {
  return <PhotoManager {...props} />;
}
