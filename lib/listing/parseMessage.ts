/**
 * "Dán tin nhắn chủ nhà" → listing fields. Rule-based (no AI), pure, unit-tested (tests/unit/parse-message.test.ts).
 * Owner-message specifics are read here (floor, area, rent like 13tr5 / 13500k / 13.500.000, deposit, payment cycle,
 * move-in date, owner phone); building / bedrooms / furniture / view / pets reuse the search parser.
 *
 * Every field carries `sure`: true = an explicit keyword pattern matched; false = a guess the user must confirm.
 * Nothing is invented: a field is only returned when the text contains it.
 */
import { norm, words } from '@/lib/search/normalize';
import { parseSearch, type BuildingRef } from '@/lib/search/parse';

export type MsgField = 'building' | 'floor' | 'unit_no' | 'beds' | 'baths' | 'area' | 'furn' | 'rent' | 'deposit' | 'cycle' | 'move_in' | 'pets' | 'view' | 'dir' | 'owner_phone';
export type MsgValue = { value: string; sure: boolean };
export type ParsedMessage = Partial<Record<MsgField, MsgValue>>;

const L = '(?<![\\p{L}\\p{N}])';
const R = '(?![\\p{L}\\p{N}])';
const rx = (src: string) => new RegExp(L + '(?:' + src + ')' + R, 'gu');

const DIRS: [string, string][] = [
  ['dong bac', 'NE'], ['dong nam', 'SE'], ['tay bac', 'NW'], ['tay nam', 'SW'],
  ['dong', 'E'], ['tay', 'W'], ['nam', 'S'], ['bac', 'N'],
];

/** "13tr5" "13,5 triệu" "13.5tr" "13500k" "13.500.000" "13 củ" → VND */
function money(num: string, unit: string | undefined, tail: string | undefined): number | undefined {
  let v: number;
  if (/^\d{1,3}([.,]\d{3})+$/.test(num)) v = Number(num.replace(/[.,]/g, '')); // 13.500.000
  else v = Number(num.replace(',', '.'));
  if (!Number.isFinite(v)) return undefined;
  const u = unit?.trim();
  if (u === 'k' || u === 'ngan' || u === 'nghin') v *= 1000;
  else if (u) {
    v *= 1e6; // tr / trieu / cu / m
    if (tail && /ruoi/.test(tail)) v += 500_000; // 7 triệu rưỡi
    else if (tail) v += Number(tail) * 10 ** (6 - tail.length); // 13tr5 → +500k, 13tr500 → +500k, 13tr05 → +50k
  } else if (v < 1000) v *= 1e6; // bare "13" next to "giá"
  return v >= 1e6 && v <= 2e8 ? Math.round(v) : undefined;
}

const NUM = '(\\d+(?:[.,]\\d+)*)';
const MUNIT = '(?:\\s*(tr|trieu|cu|m|k|ngan|nghin)(\\d{1,3}|\\s*ruoi)?)';
const VND = '(?:\\s*(?:d|vnd|dong))?';
const PRICE_WORDS = 'gia thue|gia cho thue|gia|thue|cho thue|price|rent';
const MONTH = '(?:thang|th)';

/** words that end the distinctive part of a building name */
const NAME_TAIL = new Set(['quy', 'nhon', 'residence', 'residences', 'tower', 'towers', 'hotel', 'luxury', 'garden', 'gardens', 'sea', 'river', 'riverside', 'plaza', 'apartment', 'apartments', 'condo', 'city']);

export function parseMessage(raw: string, buildings: BuildingRef[] = [], today = new Date().toISOString().slice(0, 10)): ParsedMessage {
  const out: ParsedMessage = {};
  const set = (k: MsgField, value: string | number, sure: boolean) => {
    if (!out[k] || (!out[k]!.sure && sure)) out[k] = { value: String(value), sure };
  };
  // line breaks survive norm() as ' | ' (sentence boundaries for the building / bedroom pass)
  let s = ' ' + norm(raw.slice(0, 2000).replace(/\r?\n+/g, ' | ')).replace(/[\u2013\u2014]/g, '-') + ' ';
  const take = (src: string, fn: (m: RegExpExecArray) => boolean | void) => {
    s = s.replace(rx(src), (...args) => {
      const m = args.slice(0, -2) as unknown as RegExpExecArray;
      return fn(m) === false ? m[0] : ' ';
    });
  };

  // ── owner phone (internal field only): +84 / 0 + 9 digits, spaces / dots / dashes allowed
  take('(?:\\+?84|0)(?:[\\s.-]?\\d){9}', (m) => {
    const d = m[0].replace(/\D/g, '').replace(/^84/, '0');
    if (!/^0[35789]\d{8}$/.test(d)) return false;
    set('owner_phone', d, true);
  });

  // ── fees we do not take from messages (they come from the building) — drop so they are not read as rent
  take(`(?:phi (?:quan ly|ql|dich vu|dv)|pql|phi gui xe|gui xe|internet|wifi|dien|nuoc)\\s*:?\\s*${NUM}${MUNIT}?(?:\\s*/\\s*(?:m2|${MONTH}))?`, () => {});

  // ── deposit: "cọc 2 tháng", "đặt cọc 1 tháng"
  take(`(?:dat coc|coc)\\s*:?\\s*(\\d{1,2})\\s*${MONTH}`, (m) => set('deposit', Number(m[1]), true));
  take(`(?:dat coc|coc)\\s*:?\\s*${NUM}${MUNIT}?`, () => {}); // a money deposit: not our field (months) — drop it

  // ── payment cycle: "đóng 3 tháng/lần", "thanh toán 3 tháng 1 lần", "trả theo tháng"
  take(`(?:dong|thanh toan|tra|tt)?\\s*(\\d{1,2})\\s*${MONTH}\\s*(?:/|1|mot)\\s*(?:lan|ky)`, (m) => {
    const n = Number(m[1]);
    if (n === 1 || n === 3) set('cycle', n === 1 ? 'm1' : 'm3', true);
    else return false;
  });
  take('(?:dong|thanh toan|tra|tt)\\s*(?:theo|hang)\\s*thang|hang thang', () => set('cycle', 'm1', true));

  // ── move-in: "trống từ 15/10", "vào ở ngay", "dọn vào 1/11/2026"
  take('(?:vao o|don vao|o|nhan nha|trong|san sang)\\s*(?:duoc\\s*)?ngay|trong san|co the vao ngay|available now|move in now', () => set('move_in', today, true));
  take('(?:trong|tu|don vao|vao o|nhan nha|available)\\s*(?:tu\\s*)?(?:ngay\\s*)?(\\d{1,2})\\s*[/.-]\\s*(\\d{1,2})(?:\\s*[/.-]\\s*(\\d{2,4}))?', (m) => {
    const d = Number(m[1]), mo = Number(m[2]);
    if (d < 1 || d > 31 || mo < 1 || mo > 12) return false;
    let y = m[3] ? Number(m[3].length === 2 ? '20' + m[3] : m[3]) : Number(today.slice(0, 4));
    const iso = (yy: number) => `${yy}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (!m[3] && iso(y) < today) y += 1; // "15/1" in October → next January
    set('move_in', iso(y), !!m[3]);
  });

  // ── area: "68m2", "68 m²", "68 mét vuông", "dt 68"
  take(`${NUM}\\s*(?:m2|m²|m\\^2|met vuong|m vuong)`, (m) => {
    const v = Number(m[1].replace(',', '.'));
    if (!(v > 10 && v < 1000)) return false;
    set('area', v, true);
  });
  take(`(?:dien tich|dt|s)\\s*:?\\s*${NUM}`, (m) => {
    const v = Number(m[1].replace(',', '.'));
    if (!(v > 10 && v < 1000)) return false;
    set('area', v, true);
  });

  // ── floor / unit: "tầng 18", "t18", "lầu 18", "căn 18.05", "1805"
  take('(?:tang|lau|floor)\\s*(\\d{1,2})|t(\\d{1,2})', (m) => {
    const v = Number(m[1] ?? m[2]);
    if (v > 80) return false;
    set('floor', v, true);
  });
  take('(?:can|can ho|ma can|so can|phong|ph)\\s*(?:so\\s*)?:?\\s*(\\d{1,2})[.\\-]?(\\d{2})(?![.,]\\d)', (m) => {
    set('unit_no', `${m[1]}.${m[2]}`, false);
    set('floor', Number(m[1]), false);
  });

  // ── bathrooms: "2wc", "2 vệ sinh", "2 toilet", "2 phòng tắm"
  take('(\\d)\\s*(?:wc|vs|ve sinh|nha ve sinh|toilet|phong tam|tam|bath|baths|bathroom|bathrooms)', (m) => set('baths', Number(m[1]), true));
  // "2pn2wc" glued
  take('(\\d)\\s*pn\\s*(\\d)\\s*(?:wc|vs)', (m) => { set('beds', Number(m[1]), true); set('baths', Number(m[2]), true); });

  // ── bedrooms written the owner way: "2 ngủ", "2 phòng ngủ"
  take('(\\d)\\s*(?:phong ngu|ngu)', (m) => set('beds', Number(m[1]), true));

  // ── direction: "hướng Đông Nam", "ban công hướng tây"
  take(`(?:huong|ban cong huong|cua huong)\\s*(${DIRS.map(([k]) => k).join('|')})`, (m) => set('dir', DIRS.find(([k]) => k === m[1])![1], true));

  // ── pets: negation first
  take('(?:khong|ko|k|khg|cam)\\s*(?:cho\\s*)?(?:nuoi\\s*)?(?:thu cung|pet|cho meo|cho|meo|vat nuoi)', () => set('pets', 'false', true));

  // ── rent: with a price word (sure), then a bare amount with a unit (unsure)
  take(`(?:${PRICE_WORDS})\\s*:?\\s*(?:chi\\s*)?${NUM}${MUNIT}?${VND}`, (m) => {
    const v = money(m[1], m[2], m[3]);
    if (v == null) return false;
    set('rent', v, true);
  });
  take(`${NUM}${MUNIT}(?:\\s*/\\s*${MONTH})?`, (m) => {
    const v = money(m[1], m[2], m[3]);
    if (v == null) return false;
    set('rent', v, false);
  });
  take('(\\d{1,3}(?:[.,]\\d{3}){2})(?:\\s*(?:d|vnd|dong))?', (m) => {
    const v = money(m[1], undefined, undefined);
    if (v == null) return false;
    set('rent', v, false);
  });

  // ── the rest through the search parser (building, bedrooms, furniture, view, pets) — line by line (it reads ≤ 200 chars)
  let fuzzy: string | undefined;
  for (const line of s.split(/[\n;|]|\s-\s|[.!?](?=\s)/)) {
    if (!line.trim()) continue;
    const p = parseSearch(line, buildings);
    if (p.building) {
      const b = buildings.find((x) => x.slug === p.building)!;
      const lw = ' ' + words(line).join(' ') + ' ';
      // "named": the distinctive head of a name / alias ("FLC", "Phú Tài", "An Phú Thịnh") appears as whole words
      const exact = [b.name, ...(b.aliases ?? [])].some((n) => {
        const nw = words(norm(n));
        const cut = nw.findIndex((w, i) => i > 0 && NAME_TAIL.has(w));
        const head = cut > 0 ? nw.slice(0, cut) : nw;
        return lw.includes(' ' + head.join(' ') + ' ');
      });
      if (exact) set('building', b.slug, true);
      else fuzzy ??= b.slug;
    }
    if (p.beds != null) set('beds', p.beds, true);
    if (p.furniture) set('furn', p.furniture, true);
    if (p.view) set('view', p.view, true);
    if (p.pets && !out.pets) set('pets', 'true', true);
  }
  // a fuzzy building guess only counts in a message that clearly describes an apartment
  if (fuzzy && !out.building && Object.keys(out).length >= 2) set('building', fuzzy, false);
  return out;
}

/** labels for the preview table */
export const MSG_LABEL: Record<MsgField, string> = {
  building: 'Toà nhà', floor: 'Tầng', unit_no: 'Số căn', beds: 'Phòng ngủ', baths: 'Phòng tắm', area: 'Diện tích (m²)',
  furn: 'Nội thất', rent: 'Giá thuê (₫/tháng)', deposit: 'Đặt cọc (tháng)', cycle: 'Kỳ thanh toán', move_in: 'Dọn vào từ',
  pets: 'Thú cưng', view: 'Tầm nhìn', dir: 'Hướng', owner_phone: 'SĐT chủ nhà (nội bộ)',
};
