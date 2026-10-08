/**
 * Text normalisation shared by the query parser, fuzzy matching and highlighting.
 * norm(): lowercase · NFD + strip combining marks (ё→е, й→и) · đ→d · collapse spaces. Punctuation is kept
 * (the parser needs "10-15tr", "QN-001"); words() splits on it.
 */

const MARKS = /[̀-ͯ]/g;

/** One source character → its normalised form (same length for everything we care about, used for highlighting). */
export const normChar = (c: string) => c.toLowerCase().normalize('NFD').replace(MARKS, '').replace(/đ/g, 'd');

export const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(MARKS, '').replace(/đ/g, 'd').replace(/\s+/g, ' ').trim();

/** Words of an already-normalised string (letters/digits in any script). */
export const words = (n: string) => n.split(/[^\p{L}\p{N}]+/u).filter(Boolean);

const CYR: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ж: 'zh', з: 'z', и: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
  п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '',
  э: 'e', ю: 'yu', я: 'ya',
};

/** Cyrillic → Latin (after norm), so "алтара" finds "Altara" even without an alias. Latin text is returned unchanged. */
export const translit = (n: string) => (/[а-я]/.test(n) ? n.replace(/[а-я]/g, (c) => CYR[c] ?? c) : n);
