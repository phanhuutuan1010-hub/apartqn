import { describe, expect, it } from 'vitest';
import { describeBuilding, describeUnitType, ruBeds, shown, type DescBuilding, type DescUnit } from '@/lib/content/describe';
import { LOCALES } from '@/i18n/locales';

/** Altara as stored (fees from migration 14, amenities after migration 42) and a filled-in 2PN */
const ALT: DescBuilding = {
  name: 'Altara Residences', street: 'Trần Hưng Đạo', amenities: ['pool', 'gym', 'security', 'elevator', 'car_parking', 'motorbike_parking', 'minimart'],
  fees: { mgmt_fee_per_m2: 12100, mgmt_fee_vat_pct: null, motorbike_fee: 60000, car_fee: 900000, car_parking: 'paid' },
};
const U: DescUnit = { type: '2pn', areaMin: 68, areaMax: 75.5, priceFrom: 13_000_000, furniture: 'full', views: ['sea', 'city'], features: ['washer', 'full_kitchen', 'balcony'] };

describe('generated descriptions (snapshots per language)', () => {
  it('unit type ALT-2PN · vi', () => {
    expect(describeUnitType(U, ALT, 'vi')).toMatchInlineSnapshot(`"Căn 2 phòng ngủ tại Altara Residences, đường Trần Hưng Đạo, trung tâm Quy Nhơn. Diện tích 68–75,5 m², đầy đủ nội thất, view biển và thành phố. Căn có máy giặt riêng, bếp đầy đủ dụng cụ và ban công. Toà nhà có hồ bơi, phòng gym, bảo vệ 24/7, thang máy, chỗ đậu ô tô, chỗ gửi xe máy và siêu thị mini. Giá thuê tham khảo từ 13.000.000 đ/tháng; phí quản lý 12.100 đ/m²; gửi xe máy 60.000 đ/tháng; gửi ô tô 900.000 đ/tháng. Giá có thể thay đổi theo thời hạn thuê. Thuê dài hạn từ 1 tháng."`);
  });
  it('unit type ALT-2PN · en', () => {
    expect(describeUnitType(U, ALT, 'en')).toMatchInlineSnapshot(`"2-bedroom apartment at Altara Residences on Trần Hưng Đạo street, central Quy Nhon. 68–75.5 m², fully furnished, sea and city views. In the apartment: own washing machine, fully equipped kitchen and balcony. The building has a swimming pool, a gym, 24/7 security, an elevator, car parking, motorbike parking and a mini-mart. Reference rent from 13,000,000 VND/month; management fee 12,100 VND/m²; motorbike parking 60,000 VND/month; car parking 900,000 VND/month. Price may vary by rental term. Long-term rentals from 1 month."`);
  });
  it('unit type ALT-2PN · ru', () => {
    expect(describeUnitType(U, ALT, 'ru')).toMatchInlineSnapshot(`"Квартира — 2 спальни, дом Altara Residences, улица Trần Hưng Đạo, центр Куинёна. Площадь 68–75,5 м², полностью меблирована, вид на море и город. В квартире: стиральная машина, полностью оборудованная кухня и балкон. В доме: бассейн, спортзал, охрана 24/7, лифт, парковка для автомобилей, парковка для мотобайков и мини-маркет. Аренда — от 13 000 000 VND/мес. (ориентировочно); обслуживание 12 100 VND/м²; парковка мотобайка 60 000 VND/мес.; парковка автомобиля 900 000 VND/мес. Цена может зависеть от срока аренды. Долгосрочная аренда от 1 месяца."`);
  });
  it('building · every language lists its types with their "from" prices', () => {
    const types = [{ type: 'studio' as const, priceFrom: 8_000_000 }, U];
    expect(describeBuilding(ALT, types, 'vi')).toContain('Các loại căn: studio từ 8.000.000 đ/tháng, 2 phòng ngủ từ 13.000.000 đ/tháng.');
    expect(describeBuilding(ALT, types, 'en')).toContain('Apartment types: studio from 8,000,000 VND/month, 2-bedroom from 13,000,000 VND/month.');
    expect(describeBuilding(ALT, types, 'ru')).toMatchInlineSnapshot(`"Altara Residences — жилой дом на улице Trần Hưng Đạo в центре Куинёна. В доме: бассейн, спортзал, охрана 24/7, лифт, парковка для автомобилей, парковка для мотобайков и мини-маркет. Типы квартир: студия — от 8 000 000 VND/мес., 2 спальни — от 13 000 000 VND/мес. Обслуживание 12 100 VND/м², парковка мотобайка 60 000 VND/мес., парковка автомобиля 900 000 VND/мес."`);
  });
  it('nothing invented: unknown values are left out', () => {
    const bare: DescBuilding = { name: 'Simona', street: '', amenities: [], fees: { mgmt_fee_per_m2: null, mgmt_fee_vat_pct: null, motorbike_fee: null, car_fee: null, car_parking: null } };
    for (const l of LOCALES) {
      const s = describeUnitType({ type: 'studio', areaMin: 30, areaMax: 30, priceFrom: 7_000_000, views: [], features: [] }, bare, l);
      expect(s).not.toMatch(/undefined|null|NaN/);
    }
    expect(describeUnitType({ type: 'studio', areaMin: 30, areaMax: 30, priceFrom: 7_000_000, views: [], features: [] }, bare, 'vi'))
      .toBe('Căn hộ studio tại Simona, trung tâm Quy Nhơn. Diện tích 30 m². Giá thuê tham khảo từ 7.000.000 đ/tháng. Giá có thể thay đổi theo thời hạn thuê. Thuê dài hạn từ 1 tháng.');
  });
  it('Russian bedrooms: спальня / спальни / спален, never "комнатная"', () => {
    expect([1, 2, 3, 4, 5, 11, 21, 22].map(ruBeds)).toEqual(['1 спальня', '2 спальни', '3 спальни', '4 спальни', '5 спален', '11 спален', '21 спальня', '22 спальни']);
    for (const t of ['studio', '1pn', '2pn', '3pn'] as const) expect(describeUnitType({ ...U, type: t }, ALT, 'ru')).not.toMatch(/комнат/);
  });
  it('a staff override wins for its language', () => {
    expect(shown('  Căn góc, 2 mặt thoáng.  ', () => 'generated')).toBe('Căn góc, 2 mặt thoáng.');
    expect(shown(undefined, () => 'generated')).toBe('generated');
    expect(shown('   ', () => 'generated')).toBe('generated');
  });
});
