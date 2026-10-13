/**
 * Public floor band. The site never shows the exact floor or the unit number — only "Tầng thấp / trung / cao".
 * Thirds of the building: low ≤ ceil(n/3), mid ≤ ceil(2n/3), high above (same rule as private.floor_band in SQL).
 */
export const FLOOR_BANDS = ['low', 'mid', 'high'] as const;
export type FloorBand = (typeof FLOOR_BANDS)[number];

export const BAND_LABEL: Record<'vi' | 'en', Record<FloorBand, string>> = {
  vi: { low: 'Tầng thấp', mid: 'Tầng trung', high: 'Tầng cao' },
  en: { low: 'Low floor', mid: 'Mid floor', high: 'High floor' },
};

export const isBand = (v: unknown): v is FloorBand => (FLOOR_BANDS as readonly string[]).includes(v as string);

/** null when the floor or the building's total is unknown (never guessed) */
export function bandOf(floor: number | null | undefined, total: number | null | undefined): FloorBand | null {
  if (!floor || !total || floor < 1 || total < 1) return null;
  if (floor <= Math.ceil(total / 3)) return 'low';
  if (floor <= Math.ceil((2 * total) / 3)) return 'mid';
  return 'high';
}

/** What the public sees: the admin's override, else the computed band, else the admin's choice for an uncomputable one. */
export const effectiveBand = (x: { floor?: number | null; total?: number | null; band?: string | null; manual?: boolean | null }): FloorBand | null =>
  x.manual ? (isBand(x.band) ? x.band : null) : bandOf(x.floor, x.total) ?? (isBand(x.band) ? x.band : null);

/** Exact floor / unit mentions in a public description ("tầng 22", "lầu 22", "T22", "căn 22.07", "floor 22", the unit number). */
export function floorLeaks(text: string | null | undefined, unitNo?: string | null): string[] {
  if (!text) return [];
  const found = new Set<string>();
  const pats = [/(?:tầng|tang|lầu|lau)\s*\d{1,3}\b/gi, /\bT\d{1,2}\b/g, /căn\s*(?:số\s*)?[A-Za-z]?\d+[.\-]\d+/gi, /\bfloor\s*\d{1,3}\b/gi, /\b\d{1,3}(?:st|nd|rd|th)\s+floor\b/gi];
  for (const re of pats) for (const m of text.matchAll(re)) found.add(m[0].trim());
  const u = unitNo?.trim();
  if (u && u.length >= 3 && text.toLowerCase().includes(u.toLowerCase())) found.add(u);
  return [...found].slice(0, 6);
}
