/**
 * Buildings — ported 1:1 from _handoff/design/apartqn-data.js (`B`).
 * `ward`, `lat`, `lng` are intentionally absent: they are not verified yet.
 * A building without lat/lng gets no map marker and shows "Đang cập nhật vị trí".
 * The prototype's illustrative x/y pin positions were dropped (not real coordinates).
 */

export type BuildingAmenity = 'pool' | 'gym' | 'security' | 'lift' | 'basement' | 'mart' | 'kids';

export type Building = {
  id: string;
  name: string;
  street: string;
  ward?: string;
  lat?: number;
  lng?: number;
  amenities: BuildingAmenity[];
  /** Public paths under /images/buildings/<id>/. First = cover. Empty → striped placeholder. */
  photos: string[];
  /** Data not verified by the owner yet */
  demo: boolean;
};

const p = (id: string, nums: number[]) => nums.map((n) => `/images/buildings/${id}/${String(n).padStart(2, '0')}.webp`);
const range = (a: number, b: number, skip: number[] = []) =>
  Array.from({ length: b - a + 1 }, (_, i) => a + i).filter((n) => !skip.includes(n));

// Photo curation (see report): cover first. Excluded from display but kept on disk:
// altara/08 (marketing map graphic), tms/05 + tms/09 (third-party phone numbers), tms/15 (identifiable person).
const ALTARA = p('altara', [5, 1, 2, 3, 4, 6, 7, 9]);
const FLC = p('flc', [13, 99, 98, ...range(1, 101, [13, 98, 99])]);
const TMS = p('tms', [63, 61, 62, ...range(1, 64, [5, 9, 15, 61, 62, 63])]);

export const BUILDINGS: Building[] = [
  { id: 'altara', name: 'Altara Residences Quy Nhơn', street: 'Trần Hưng Đạo', amenities: ['pool', 'gym', 'security', 'lift', 'basement', 'mart'], photos: ALTARA, demo: true },
  { id: 'phutai', name: 'Phú Tài Residence', street: 'Lý Thái Tổ', amenities: ['security', 'lift', 'basement', 'mart', 'kids'], photos: [], demo: true },
  { id: 'flc', name: 'FLC Sea Tower Quy Nhơn', street: 'An Dương Vương', amenities: ['pool', 'gym', 'security', 'lift', 'basement', 'mart'], photos: FLC, demo: true },
  { id: 'tms', name: 'TMS Luxury Hotel & Residences Quy Nhơn', street: 'Nguyễn Huệ', amenities: ['pool', 'gym', 'security', 'lift', 'basement'], photos: TMS, demo: true },
  { id: 'hagl', name: 'HAGL Quy Nhơn', street: 'Đầm sinh thái Đống Đa', amenities: ['pool', 'security', 'lift', 'basement', 'mart', 'kids'], photos: [], demo: true },
  { id: 'apt', name: 'An Phú Thịnh Garden Tower', street: 'KĐT An Phú Thịnh', amenities: ['security', 'lift', 'mart', 'kids'], photos: [], demo: true },
  { id: 'thinhphat', name: 'Thịnh Phát Tower', street: 'Thanh Niên', amenities: ['pool', 'security', 'lift', 'basement'], photos: [], demo: true },
  { id: 'ecolife', name: 'Ecolife Riverside', street: 'Điện Biên Phủ', amenities: ['pool', 'gym', 'security', 'lift', 'mart', 'kids'], photos: [], demo: true },
];
