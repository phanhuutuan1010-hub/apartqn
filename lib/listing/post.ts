/**
 * "Tạo bài đăng": Facebook (full) / Zalo (short) × vi / en, built ONLY from the listing's own public fields.
 * Empty fields are skipped; nothing is invented; owner data, unit number and internal notes are never inputs here.
 * Pure — unit-tested in tests/unit/post.test.ts.
 */

export type PostData = {
  code: string | null;
  building: string;
  beds: number | null;
  area: number | null;
  floor: number | null;
  furn: 'full' | 'basic' | 'empty' | null;
  rent: number | null;
  mgmt: number | null;
  mgmtPaidBy: 'tenant' | 'owner' | null;
  /** YYYY-MM-DD */
  moveIn: string | null;
  /** public listing page — only when the listing is published */
  url: string | null;
  /** short excerpt of the English description — only when it is translated from the current Vietnamese */
  excerptEn?: string | null;
};
export type PostChannel = 'facebook' | 'zalo';
export type PostLang = 'vi' | 'en';

const FURN = {
  vi: { full: 'Nội thất đầy đủ', basic: 'Nội thất cơ bản', empty: 'Không nội thất' },
  en: { full: 'Fully furnished', basic: 'Basic furniture', empty: 'Unfurnished' },
} as const;

const money = (n: number, l: PostLang) => (l === 'vi' ? new Intl.NumberFormat('vi-VN').format(n) + ' đ' : new Intl.NumberFormat('en-US').format(n) + ' VND');
const dmy = (iso: string) => iso.split('-').reverse().join('/');

function parts(d: PostData, l: PostLang, today: string) {
  const vi = l === 'vi';
  const beds = d.beds == null ? null : d.beds === 0 ? 'Studio' : vi ? `${d.beds} PN` : `${d.beds} bedroom${d.beds === 1 ? '' : 's'}`;
  const area = d.area ? `${String(d.area).replace('.', vi ? ',' : '.')} m²` : null;
  const floor = d.floor != null ? (vi ? `Tầng ${d.floor}` : `Floor ${d.floor}`) : null;
  const furn = d.furn ? FURN[l][d.furn] : null;
  const rent = d.rent ? `${money(d.rent, l)}${vi ? '/tháng' : '/month'}` : null;
  const mgmt =
    d.mgmtPaidBy === 'owner' ? (vi ? 'Phí quản lý: chủ nhà trả' : 'Management fee: paid by the owner')
    : d.mgmtPaidBy === 'tenant' && d.mgmt ? (vi ? `Phí quản lý: ${money(d.mgmt, l)}/tháng (khách trả)` : `Management fee: ${money(d.mgmt, l)}/month (tenant)`)
    : null;
  const moveIn = !d.moveIn ? null
    : d.moveIn <= today ? (vi ? 'Dọn vào ở ngay' : 'Available now')
    : vi ? `Dọn vào từ ${dmy(d.moveIn)}` : `Available from ${dmy(d.moveIn)}`;
  return { beds, area, floor, furn, rent, mgmt, moveIn };
}

export function buildPost(d: PostData, o: { channel: PostChannel; lang: PostLang; phone: string; today?: string }): string {
  const vi = o.lang === 'vi';
  const today = o.today ?? new Date().toISOString().slice(0, 10);
  const p = parts(d, o.lang, today);
  const phone = o.phone.trim();
  const join = (xs: (string | null | undefined | false)[], sep: string) => xs.filter(Boolean).join(sep);

  if (o.channel === 'zalo') {
    const head = join([vi ? 'Cho thuê' : 'For rent:', d.code, d.building ? `· ${d.building}` : null], ' ');
    const line = join([p.beds, p.area, p.floor, p.furn, p.rent], ' · ');
    return join([
      join([head, line], vi ? ' — ' : ' — '),
      p.moveIn,
      p.mgmt,
      phone && (vi ? `LH: ${phone}` : `Call / Zalo: ${phone}`),
      d.url,
    ], '\n');
  }

  const title = join([vi ? '🏢 CHO THUÊ CĂN HỘ' : '🏢 APARTMENT FOR RENT', p.beds && `${p.beds}`, d.building && `· ${d.building}`], ' ');
  const bullets = [
    d.code && (vi ? `Mã căn: ${d.code}` : `Code: ${d.code}`),
    join([p.area && (vi ? `Diện tích ${p.area}` : `Area ${p.area}`), p.floor], ' · '),
    p.furn,
    p.rent && (vi ? `Giá thuê: ${p.rent}` : `Rent: ${p.rent}`),
    p.mgmt,
    p.moveIn,
  ].filter(Boolean).map((x) => `• ${x}`);
  return join([
    title,
    bullets.join('\n'),
    !vi && d.excerptEn,
    phone && (vi ? `📞 Liên hệ: ${phone}` : `📞 Contact: ${phone}`),
    d.url && `🔗 ${d.url}`,
  ], '\n\n');
}
