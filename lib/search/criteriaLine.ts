import type { Locale } from '@/i18n/routing';
import type { FloorBand } from '@/lib/floorBand';
import { BAND_LABEL } from '@/lib/floorBand';

/** The parts of the results-page filters that describe what the visitor wants (lib/filters.ts names). */
export type Criteria = {
  b?: string; beds?: string; rent?: string; pmin?: string; pmax?: string; fl?: string; furn?: string; vw?: string;
  near?: string; pets?: boolean; car?: boolean; date?: string; q?: string;
};

const L = {
  vi: {
    beds: (n: string) => (n === '0' ? 'Studio' : n === '01' ? 'Studio / 1 PN' : n === '3' ? '3+ PN' : `${n} PN`),
    rent: ['dưới 8 triệu', '8–12 triệu', '12–18 triệu', 'trên 18 triệu'],
    mil: (s: string) => `${s.replace('.', ',')} triệu`,
    furn: { full: 'Nội thất đầy đủ', basic: 'Nội thất cơ bản', empty: 'Không nội thất' } as Record<string, string>,
    vw: { sea: 'View biển', city: 'View thành phố', river: 'View sông', lagoon: 'View đầm' } as Record<string, string>,
    near: 'Gần biển', pets: 'Cho nuôi thú cưng', car: 'Có chỗ đậu ô tô',
  },
  en: {
    beds: (n: string) => (n === '0' ? 'studio' : n === '01' ? 'studio / 1 bedroom' : n === '3' ? '3+ bedrooms' : n === '1' ? '1 bedroom' : `${n} bedrooms`),
    rent: ['under 8 million VND', '8–12 million VND', '12–18 million VND', 'over 18 million VND'],
    mil: (s: string) => `${s} million VND`,
    furn: { full: 'fully furnished', basic: 'basic furniture', empty: 'unfurnished' } as Record<string, string>,
    vw: { sea: 'sea view', city: 'city view', river: 'river view', lagoon: 'lagoon view' } as Record<string, string>,
    near: 'near the sea', pets: 'pets allowed', car: 'car parking',
  },
};

/**
 * Criteria → short localized parts: building · beds · price range · floor band · features.
 * `date` (move-in) only with `withDate` (staff line of the request form); free text (`q`) is never a part.
 */
export function criteriaParts(c: Criteria, l: Locale, buildingName?: string, withDate = false): string[] {
  const x = L[l];
  const parts: string[] = [];
  if (c.b) parts.push(buildingName ?? c.b);
  if (c.beds) parts.push(x.beds(c.beds));
  const r = c.rent ? x.rent[Number(c.rent.slice(1))] : undefined;
  if (r) parts.push(r);
  if (c.pmin && c.pmax) parts.push(l === 'vi' ? `${c.pmin.replace('.', ',')}–${x.mil(c.pmax)}` : `${c.pmin}–${x.mil(c.pmax)}`);
  else if (c.pmax) parts.push(`≤ ${x.mil(c.pmax)}`);
  else if (c.pmin) parts.push(`≥ ${x.mil(c.pmin)}`);
  if (c.fl && c.fl in BAND_LABEL[l]) parts.push(BAND_LABEL[l][c.fl as FloorBand]);
  if (c.furn && x.furn[c.furn]) parts.push(x.furn[c.furn]);
  if (c.vw && x.vw[c.vw]) parts.push(x.vw[c.vw]);
  if (c.near === 'sea' && c.vw !== 'sea') parts.push(x.near);
  if (c.pets) parts.push(x.pets);
  if (c.car) parts.push(x.car);
  if (withDate && c.date) parts.push(l === 'vi' ? `dọn vào trước ${c.date.split('-').reverse().join('/')}` : `move in by ${c.date}`);
  return parts;
}

/** Staff line, Vietnamese: "Altara · 2 PN · ≤ 12 triệu · Cho nuôi thú cưng · “gần chợ”" */
export const criteriaLine = (c: Criteria, buildingName?: string, withDate = true) =>
  [...criteriaParts(c, 'vi', buildingName, withDate), ...(c.q ? [`“${c.q}”`] : [])].join(' · ');

/**
 * The message typed into Zalo / WhatsApp / Telegram from a search with no match: the search text + the parsed criteria,
 * nothing else.
 */
export function findHelpMessage(l: Locale, query: string, parts: string[]): string {
  const q = query.trim();
  const what = [q && `“${q}”`, ...parts].filter(Boolean).join(' · ');
  if (l === 'vi') return what ? `Chào ApartQN, tôi cần tìm căn hộ: ${what}. Nhờ tìm giúp tôi.` : 'Chào ApartQN, tôi cần tìm căn hộ. Nhờ tìm giúp tôi.';
  return what ? `Hi ApartQN, I'm looking for an apartment: ${what}. Could you help me find one?` : "Hi ApartQN, I'm looking for an apartment. Could you help me find one?";
}
