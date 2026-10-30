import { describe, expect, it } from 'vitest';
import { buildRoundup, buildTypePost, postMoney, typeLink, type TypePost } from '@/lib/unitTypePost';

const D: TypePost = { code: 'ALT-2PN', type: '2pn', building: 'Altara Residences', priceFrom: 13_500_000, areaMin: 68, areaMax: 75.5, views: ['sea'], furniture: 'basic', features: ['balcony', 'full_kitchen'], photoCount: 6 };
const O = { channel: 'facebook' as const, pair: 'vi-en' as const, origin: 'https://apartqn.com' };

describe('unit type post', () => {
  it('Facebook VI/EN: type · building, "Từ" price · area, two features, sample photos, the type link', () => {
    expect(buildTypePost(D, O)).toBe([
      '🏢 Căn 2 phòng ngủ · Altara Residences – Quy Nhơn',
      'Từ 13.500.000 đ/tháng · 68–75,5 m²',
      'View biển · ban công',
      '📷 Ảnh căn mẫu',
      '👉 apartqn.com/ALT-2PN',
      '',
      '🏢 2-bedroom apartment · Altara Residences – Quy Nhon',
      'From 13,500,000 VND/month · 68–75.5 m²',
      'Sea view · balcony',
      '📷 Sample unit photos',
      '👉 apartqn.com/en/ALT-2PN',
    ].join('\n'));
  });
  it('Zalo: Vietnamese only; no photos → no photo line; no features → no line', () => {
    const t = buildTypePost({ ...D, views: [], features: [], photoCount: 0, areaMax: 68 }, { ...O, channel: 'zalo' });
    expect(t).toBe('🏢 Căn 2 phòng ngủ · Altara Residences – Quy Nhơn\nTừ 13.500.000 đ/tháng · 68 m²\n👉 apartqn.com/ALT-2PN');
  });
  it('RU/EN: Russian block first, then English; both link apartqn.com/{CODE}; never a phone number or availability', () => {
    const t = buildTypePost(D, { ...O, pair: 'ru-en' });
    expect(t.split('\n\n')[0]).toContain('От 13 500 000 VND/мес.');
    expect(t.split('\n\n')[0]).toContain('Квартира — 2 спальни');
    expect(t.split('\n\n')[1]).toContain('From 13,500,000 VND/month');
    expect(t.match(/👉 apartqn\.com\/ALT-2PN/g)).toHaveLength(2);
    expect(t).not.toMatch(/\d{9,}|còn trống|available/i);
  });
  it('roundup of one type across buildings, cheapest first', () => {
    const t = buildRoundup('2pn', [D, { ...D, code: 'FLC-2PN', building: 'FLC Sea Tower', priceFrom: 12_000_000 }], { ...O, channel: 'zalo' });
    expect(t).toBe([
      '🏢 Căn 2PN tại 2 toà trung tâm Quy Nhơn, từ 12.000.000 đ/tháng',
      '• FLC Sea Tower: từ 12.000.000 đ — apartqn.com/FLC-2PN',
      '• Altara Residences: từ 13.500.000 đ — apartqn.com/ALT-2PN',
      '📷 Ảnh căn mẫu',
    ].join('\n'));
    expect(buildRoundup('3pn', [], O)).toBe('');
  });
  it('money and links', () => {
    expect([postMoney(8e6, 'vi'), postMoney(8e6, 'en'), postMoney(8e6, 'ru')]).toEqual(['8.000.000 đ', '8,000,000 VND', '8 000 000 VND']);
    expect(typeLink('https://apartqn.com/', 'alt-studio', 'vi')).toBe('apartqn.com/ALT-STUDIO');
  });
});
