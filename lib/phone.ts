/** Vietnamese phone numbers as stored in settings ("+84 905 123 456", "0905.123.456", "1900 1234") → links and display. */
const digits = (s: string) => s.replace(/\D/g, '');

/** national form: +84 / 84 prefix → 0 */
export function toLocal(s: string): string {
  const d = digits(s);
  if (/^84\d{9,10}$/.test(d)) return '0' + d.slice(2);
  return d;
}

/** mobile: 0 + 3/5/7/8/9 + 8 digits */
export const isVnMobile = (s: string) => /^0[35789]\d{8}$/.test(toLocal(s));

/** "0905 123 456" (mobile), "0256 381 2345" (landline), "1900 1234" (hotline); anything else as typed */
export function fmtPhone(s: string): string {
  const d = toLocal(s);
  if (/^0\d{9}$/.test(d)) return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
  if (/^0\d{10}$/.test(d)) return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
  if (/^1[89]00\d{4,6}$/.test(d)) return `${d.slice(0, 4)} ${d.slice(4)}`;
  return s.trim();
}

export const telHref = (s: string) => {
  const d = toLocal(s);
  return /^0\d{9,10}$/.test(d) ? `tel:+84${d.slice(1)}` : `tel:${d}`;
};
/** zalo.me takes the national number */
export const zaloHref = (s: string) => `https://zalo.me/${toLocal(s)}`;
/** wa.me needs the international number without "+"; null for numbers WhatsApp can't reach (1900…) */
export const waHref = (s: string) => {
  const d = toLocal(s);
  return /^0\d{9,10}$/.test(d) ? `https://wa.me/84${d.slice(1)}` : null;
};
