/**
 * Rental term: "thuê dài hạn từ 1 tháng" / "long-term rentals from 1 month" / "долгосрочная аренда от 1 месяца".
 * MIN_TERM is the default of listings.min_term and unit_types.min_term (migration 43).
 */
export const MIN_TERM = 1;

type L = 'vi' | 'en' | 'ru';

/** "1 month" / "2 months"; ru genitive after "от": 1 месяца, 2 месяцев… (от + genitive) */
export function months(n: number, l: L): string {
  if (l === 'vi') return `${n} tháng`;
  if (l === 'en') return `${n} month${n === 1 ? '' : 's'}`;
  return `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'месяца' : 'месяцев'}`;
}

export function termText(l: L, n: number = MIN_TERM): string {
  if (l === 'vi') return `Thuê dài hạn từ ${months(n, l)}`;
  if (l === 'en') return `Long-term rentals from ${months(n, l)}`;
  return `Долгосрочная аренда от ${months(n, l)}`;
}

export const PRICE_VARIES: Record<L, string> = {
  vi: 'Giá có thể thay đổi theo thời hạn thuê',
  en: 'Price may vary by rental term',
  ru: 'Цена может зависеть от срока аренды',
};
