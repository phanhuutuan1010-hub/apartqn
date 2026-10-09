import type { GalleryLabels } from '@/components/Gallery';
import type { PhotoTag } from './types';

type T = (key: string, values?: Record<string, string | number>) => string;
const TAG_KEY: Record<PhotoTag, string> = { 'toan-canh': 'tg_toan_canh', 'tien-ich': 'tg_tien_ich', sanh: 'tg_sanh', view: 'tg_view', 'can-ho': 'tg_can_ho', khac: 'tg_khac' };

/** Plain strings for the client gallery / lightbox (functions can't cross the server → client boundary). */
export const galleryLabels = (t: T): GalleryLabels => ({
  showAll: t('showAll'), video: t('video'), close: t('close'), prev: t('gPrev'), next: t('gNext'), all: t('gAll'),
  more: t('gMore', { n: '{n}' }), own: t('photoOwn'), reference: t('photoRef'),
  tags: Object.fromEntries(Object.entries(TAG_KEY).map(([k, v]) => [k, t(v)])) as Record<PhotoTag, string>,
});
