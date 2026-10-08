/** Free-text filter shared by the results page and suggestions (kept apart from the parser so pages stay light). */
import { norm, translit, words } from './normalize';
import { matchWords, MIN_SCORE, splitWords } from './fuzzy';
import type { IndexBuilding } from './types';

export const qWords = (s: string) => words(norm(s)).map(translit);

/** Does every word of `text` name this building (name, aliases, street, wards)? */
export function textMatches(text: string, b: Pick<IndexBuilding, 'name' | 'aliases' | 'street' | 'ward_new' | 'ward_old'> | undefined) {
  const qs = qWords(text);
  if (!qs.length) return true;
  if (!b) return false;
  const fields = [b.name, ...b.aliases, b.street, b.ward_new ?? '', b.ward_old ?? ''].filter(Boolean).map((f) => splitWords(f.normalize('NFC')));
  return qs.every((q) => fields.some((f) => matchWords([q], f).per[0] >= MIN_SCORE));
}
