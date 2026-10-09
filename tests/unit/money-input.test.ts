import { describe, expect, it } from 'vitest';
import { parseSearch } from '@/lib/search/parse';
import { money } from '@/lib/format';

describe('money: one display format, any input', () => {
  it('displays full numbers: vi "đ", en "VND"', () => {
    expect(money(9_000_000, 'vi')).toBe('9.000.000 đ');
    expect(money(9_000_000, 'en')).toBe('9,000,000 VND');
    expect(money(13_500_000, 'en')).not.toMatch(/M|₫|đ/);
  });
  it('search input still accepts 9tr / 9m / 9 million', () => {
    for (const q of ['dưới 9tr', 'under 9m', 'under 9 million']) expect(parseSearch(q).priceMax, q).toBe(9_000_000);
  });
});
