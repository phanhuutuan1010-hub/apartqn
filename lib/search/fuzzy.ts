/**
 * Small fuzzy scorer (no dependency): exact > prefix (still typing) > 1–2 typos (Damerau, adjacent swap = 1).
 * Words are compared in normalised + transliterated form, so diacritics, đ/d and Cyrillic/Latin don't matter.
 */
import { normChar, translit } from './normalize';

/** Optimal string alignment distance; returns max + 1 as soon as it can't be ≤ max. */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      rowMin = Math.min(rowMin, v);
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length];
}

/** typos tolerated for a query word of this length: 1–3 → 0, 4–7 → 1, 8+ → 2 */
export const typos = (n: number) => (n >= 8 ? 2 : n >= 4 ? 1 : 0);

/** How well query word q matches candidate word w (both normalised+translit): 1 · .9 prefix · .8/.7 typo · .65 typo while typing · 0 */
export function wordScore(q: string, w: string): number {
  if (q === w) return 1;
  if (q.length >= 2 && w.startsWith(q)) return 0.9;
  const k = typos(q.length);
  if (!k) return 0;
  const d = editDistance(q, w, k);
  if (d <= k) return d === 1 ? 0.8 : 0.7;
  if (w.length > q.length && editDistance(q, w.slice(0, q.length), 1) <= 1) return 0.65;
  return 0;
}

export const MIN_SCORE = 0.65;

export type Word = { w: string; start: number; end: number; plain: boolean };

/** Words of a display string with their [start, end) offsets (for highlighting). Input should be NFC. */
export function splitWords(src: string): Word[] {
  const out: Word[] = [];
  let cur = '', start = -1;
  for (let i = 0; i <= src.length; i++) {
    const c = i < src.length ? normChar(src[i]) : ' ';
    if (c && /^[\p{L}\p{N}]+$/u.test(c)) {
      if (start < 0) start = i;
      cur += c;
    } else if (start >= 0) {
      const w = translit(cur);
      out.push({ w, start, end: i, plain: w === cur && cur.length === i - start });
      cur = '';
      start = -1;
    }
  }
  return out;
}

export type Hit = {
  /** mean best score over the query words (0..1) */
  score: number;
  /** per query word: best score */
  per: number[];
  /** per query word: matched source range */
  at: ([number, number] | null)[];
  /** source ranges to highlight */
  ranges: [number, number][];
};

/**
 * Match query words (normalised+translit) against a candidate's words. Also tries two adjacent
 * candidate words glued together ("phutai" ↔ "Phú Tài") and two adjacent query words glued ("eco life" ↔ "Ecolife").
 */
export function matchWords(qs: string[], cand: Word[]): Hit {
  const per = qs.map(() => 0);
  const rng: ([number, number] | null)[] = qs.map(() => null);
  const pairs = cand.slice(0, -1).map((a, i) => ({ w: a.w + cand[i + 1].w, start: a.start, end: cand[i + 1].end, plain: false }));
  qs.forEach((q, qi) => {
    for (const c of [...cand, ...pairs]) {
      const s = wordScore(q, c.w);
      if (s > per[qi]) {
        per[qi] = s;
        // prefix of an untransliterated word → highlight only the typed part
        rng[qi] = s === 0.9 && c.plain ? [c.start, c.start + q.length] : [c.start, c.end];
      }
    }
  });
  for (let i = 0; i < qs.length - 1; i++) {
    if (per[i] >= MIN_SCORE && per[i + 1] >= MIN_SCORE) continue;
    const j = qs[i] + qs[i + 1];
    for (const c of cand) {
      const s = wordScore(j, c.w);
      if (s >= MIN_SCORE && s > Math.min(per[i], per[i + 1])) {
        per[i] = per[i + 1] = s;
        rng[i] = [c.start, c.end];
        rng[i + 1] = null;
      }
    }
  }
  const ranges = rng.filter((r, i): r is [number, number] => !!r && per[i] >= MIN_SCORE);
  return { score: qs.length ? per.reduce((a, b) => a + b, 0) / qs.length : 0, per, at: rng, ranges };
}

/** Merge overlapping ranges and cut `src` into plain / highlighted parts. */
export function highlightParts(src: string, ranges: [number, number][]): { t: string; hl: boolean }[] {
  const rs = [...ranges].sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const r of rs) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  const out: { t: string; hl: boolean }[] = [];
  let at = 0;
  for (const [a, b] of merged) {
    if (a > at) out.push({ t: src.slice(at, a), hl: false });
    out.push({ t: src.slice(a, b), hl: true });
    at = b;
  }
  if (at < src.length) out.push({ t: src.slice(at), hl: false });
  return out;
}
