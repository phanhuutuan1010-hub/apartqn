import 'server-only';
import { createHash } from 'node:crypto';
import { normVi, type EnStatus } from '@/lib/translate';

/** Same as private.vi_hash in the database. */
export const viHash = (vi: string | null | undefined) => {
  const v = normVi(vi);
  return v ? createHash('sha256').update(v, 'utf8').digest('hex') : null;
};

/** Same as private.en_status: na · none · stale · ok. */
export function enStatusOf(vi: string | null | undefined, en: string | null | undefined, hash: string | null | undefined): EnStatus {
  if (!normVi(vi)) return 'na';
  if (!(en ?? '').trim()) return 'none';
  return hash && hash === viHash(vi) ? 'ok' : 'stale';
}
