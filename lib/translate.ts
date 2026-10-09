/**
 * Manual-assisted EN translation (no translation API): the copy block staff paste into Claude, clean-up of what they paste
 * back, the VI ↔ EN number check, and the normalisation the "source hash" uses (same as private.vi_hash in the database).
 */

export { EN_STATUS_LABEL, normVi, type EnStatus, type GlossaryPair } from './translateCore';
import type { GlossaryPair } from './translateCore';

export const INSTRUCTION =
  'Translate Vietnamese to English for a long-term apartment rental listing. Translate faithfully; do not add, remove or embellish information; keep numbers, units, building names unchanged; output only the translation.';

/** One block for the clipboard: instruction + glossary + the Vietnamese text. */
export function copyBlock(vi: string, glossary: GlossaryPair[]): string {
  const g = glossary.filter(([a, b]) => a.trim() && b.trim()).map(([a, b]) => `- ${a.trim()} → ${b.trim()}`);
  return [
    INSTRUCTION,
    '',
    'Glossary (Vietnamese → English; building names stay unchanged):',
    ...(g.length ? g : ['- (none)']),
    '',
    'Vietnamese:',
    vi.trim(),
  ].join('\n');
}

/** What comes back from a chat: drop code fences, a leading "English:" / "Translation:" label and wrapping quotes. */
export function cleanPasted(raw: string): string {
  let s = raw.replace(/\r\n/g, '\n').trim();
  s = s.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '').trim();
  s = s.replace(/^(?:\*\*)?(?:here(?:'s| is) the translation|english(?: translation)?|translation|bản dịch)(?:\*\*)?\s*:\s*(?:\*\*)?\s*/i, '').trim();
  const pairs: [string, string][] = [['"', '"'], ['“', '”'], ["'", "'"], ['‘', '’'], ['«', '»']];
  for (const [a, b] of pairs) {
    if (s.length > 1 && s.startsWith(a) && s.endsWith(b) && !s.slice(1, -1).includes(b === a ? a : b)) { s = s.slice(1, -1).trim(); break; }
  }
  return s;
}

const MULT: Record<string, number> = { tr: 1e6, 'triệu': 1e6, trieu: 1e6, 'củ': 1e6, cu: 1e6, million: 1e6, millions: 1e6, mil: 1e6, k: 1e3, 'nghìn': 1e3, 'ngàn': 1e3, nghin: 1e3, ngan: 1e3, thousand: 1e3 };

/** "13.500.000", "13,500,000" → 13500000 · "13,5" / "13.5" → 13.5 · "1.200" → 1200 */
function parseNum(s: string): number {
  if (/^\d{1,3}([.,]\d{3})+$/.test(s)) return Number(s.replace(/[.,]/g, ''));
  return Number(s.replace(',', '.'));
}

/**
 * Every number a reader would check (prices, m², floors, months, dates), normalised: "13tr5" = "13.5 million" = 13500000,
 * "68m2" = "68 m²" = 68. Duplicates collapse.
 */
export function numbersIn(text: string): Set<number> {
  const out = new Set<number>();
  const s = text.toLowerCase().replace(/m2\b/g, 'm² ').replace(/(\d)\s*(tr|triệu)\s*(\d{1,3})\b/g, (_, a, _u, b) => `${a}.${b} triệu`);
  const re = /(\d+(?:[.,]\d+)*)(?:\s*(triệu|trieu|tr|củ|cu|millions?|mil|k|nghìn|ngàn|nghin|ngan|thousand)(?!\p{L}))?/gu;
  for (const m of s.matchAll(re)) {
    const n = parseNum(m[1]);
    if (!Number.isFinite(n)) continue;
    out.add(Math.round(n * (m[2] ? MULT[m[2]] ?? 1 : 1) * 100) / 100);
  }
  return out;
}

const fmt = (n: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(n);

/** Numbers present on one side only. Empty arrays = they agree. */
export function numberMismatch(vi: string, en: string): { onlyVi: string[]; onlyEn: string[] } {
  const a = numbersIn(vi), b = numbersIn(en);
  return { onlyVi: [...a].filter((n) => !b.has(n)).map(fmt), onlyEn: [...b].filter((n) => !a.has(n)).map(fmt) };
}

/** One line for the amber warning, or '' when the numbers match. */
export function mismatchText(vi: string, en: string): string {
  if (!vi.trim() || !en.trim()) return '';
  const { onlyVi, onlyEn } = numberMismatch(vi, en);
  if (!onlyVi.length && !onlyEn.length) return '';
  return `Số khác nhau giữa VI và EN — chỉ có ở VI: ${onlyVi.join(', ') || '—'}; chỉ có ở EN: ${onlyEn.join(', ') || '—'}. Kiểm tra lại (vẫn lưu được).`;
}

/** Short EN excerpt for "Tạo bài đăng": the first sentence(s) up to ~180 characters, cut on a word. */
export function excerpt(text: string, max = 180): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const sentences = t.match(/[^.!?]+[.!?]+/g) ?? [];
  let out = '';
  for (const s of sentences) { if ((out + s).trim().length > max) break; out += s; }
  if (out.trim()) return out.trim();
  return t.slice(0, max).replace(/\s+\S*$/, '') + '…';
}
