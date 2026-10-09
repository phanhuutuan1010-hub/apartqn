/** The small part of lib/translate the always-loaded admin UI needs (status labels, VI normalisation). */
export type EnStatus = 'na' | 'none' | 'stale' | 'ok';
export type GlossaryPair = [vi: string, en: string];

export const EN_STATUS_LABEL: Record<EnStatus, { label: string; tone: string }> = {
  na: { label: 'Không có mô tả', tone: 'outline' },
  none: { label: 'Chưa dịch', tone: 'outline' },
  stale: { label: 'Cần cập nhật', tone: 'warn' },
  ok: { label: 'Đã dịch', tone: 'ok' },
};

/** The Vietnamese text as hashed (\r\n → \n, outer whitespace trimmed). Empty → null. Same as private.vi_hash. */
export const normVi = (t: string | null | undefined) => {
  const s = (t ?? '').replace(/\r\n/g, '\n').replace(/^[ \n\t\r]+|[ \n\t\r]+$/g, '');
  return s || null;
};
