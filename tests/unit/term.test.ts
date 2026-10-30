import { describe, expect, it } from 'vitest';
import { parseSearch } from '@/lib/search/parse';
import { months, termText } from '@/lib/term';

describe('rental term', () => {
  it('text, singular for 1', () => {
    expect(termText('vi')).toBe('Thuê dài hạn từ 1 tháng');
    expect(termText('en')).toBe('Long-term rentals from 1 month');
    expect(termText('ru')).toBe('Долгосрочная аренда от 1 месяца');
    expect(months(3, 'en')).toBe('3 months');
    expect(months(5, 'ru')).toBe('5 месяцев');
  });
  it('search accepts 1 tháng / 1 month / 1 месяц without narrowing', () => {
    expect(parseSearch('studio 1 tháng')).toEqual({ beds: 0, months: 1, text: '' });
    expect(parseSearch('1 month studio')).toEqual({ beds: 0, months: 1, text: '' });
    expect(parseSearch('студия 1 месяц')).toEqual({ beds: 0, months: 1, text: '' });
    expect(parseSearch('8 triệu/tháng')).toEqual({ priceMax: 8000000, text: '' });
  });
});
