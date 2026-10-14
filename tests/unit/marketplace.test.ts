import { describe, expect, it } from 'vitest';
import { mkpDescription, mkpFields, mkpLink, mkpReply, mkpTitle, shortBuilding, type MkpData } from '@/lib/listing/marketplace';

const d: MkpData = { code: 'ALT-003', building: 'Altara Residences', street: '76 Trần Hưng Đạo', beds: 2, baths: 2, area: 61, rent: 13000000, moveIn: '2026-10-01',
  floorBand: 'mid', furn: 'full', pets: false, carParking: true, descVi: 'Căn góc nhiều ánh sáng, ban công nhìn ra biển. Gần chợ.', descEn: null };
const today = '2026-10-14';

describe('Facebook Marketplace kit', () => {
  it('title: short building, bedrooms, floor band, city, code; never over 100 characters', () => {
    expect(mkpTitle(d)).toBe('Altara 2PN · Tầng trung · Quy Nhơn | ApartQN ALT-003');
    expect(mkpTitle({ ...d, beds: 0, floorBand: null })).toBe('Altara Studio · Quy Nhơn | ApartQN ALT-003');
    const long = mkpTitle({ ...d, building: 'Khu căn hộ cao cấp ven biển '.repeat(6) });
    expect(long.length).toBeLessThanOrEqual(100);
    expect(long.endsWith('… 2PN · Tầng trung · Quy Nhơn | ApartQN ALT-003')).toBe(true);
    expect(shortBuilding('FLC Sea Tower')).toBe('FLC Sea');
    expect(shortBuilding('Residences')).toBe('Residences');
  });
  it('fields in the form order: plain rent number, location without unit or floor, a date not in the past, stored amenities only', () => {
    const f = mkpFields(d, today);
    expect(f.map((x) => x.label)).toEqual(['Loại tài sản', 'Số phòng ngủ', 'Số phòng tắm', 'Giá/tháng (VND)', 'Vị trí gợi ý', 'Diện tích (m²)', 'Ngày có sẵn', 'Chỗ đậu xe']);
    expect(f[3].value).toBe('13000000');
    expect(f[4].value).toBe('Altara Residences, 76 Trần Hưng Đạo, Quy Nhơn');
    expect(f[6].value).toBe('14/10/2026');
    expect(mkpFields({ ...d, moveIn: '2026-11-05', pets: true, carParking: null }, today).slice(6).map((x) => x.value)).toEqual(['05/11/2026', 'Cho phép nuôi thú cưng']);
  });
  it('description: short block per language, one line of the description when there is one, plain domain — no link, no phone', () => {
    const vi = mkpDescription(d, 'vi', today);
    expect(vi.split('\n')).toEqual([
      'Cho thuê dài hạn: Altara Residences, Quy Nhơn', '• Giá thuê: 13.000.000 đ/tháng', '• 2 phòng ngủ · 2 phòng tắm · 61 m² · Tầng trung', '• Dọn vào ngay', '• Nội thất đầy đủ',
      'Căn góc nhiều ánh sáng, ban công nhìn ra biển.', 'Xem chi tiết & đặt lịch: apartqn.com · Mã ALT-003',
    ]);
    const en = mkpDescription({ ...d, moveIn: '2026-11-05' }, 'en', today);
    expect(en.split('\n')).toEqual([
      'Long-term rental: Altara Residences, Quy Nhon', '• Rent: 13,000,000 VND/month', '• 2 bedrooms · 2 bathrooms · 61 m² · Mid floor', '• Available from 5 Nov', '• Fully furnished',
      'Details & viewing: apartqn.com · Code ALT-003',
    ]);
    for (const t of [vi, en]) { expect(t).not.toMatch(/https?:|www\.|\/c\//); expect(t).not.toMatch(/\d{9,}/); }
    expect(mkpDescription({ ...d, descVi: 'Gọi 0905 123 456 để xem nhà.' }, 'vi', today)).not.toContain('0905');
  });
  it('Messenger reply carries the counted short link', () => {
    expect(mkpLink('https://apartqn.com/', 'ALT-003')).toBe('https://apartqn.com/c/alt-003?s=mkp');
    expect(mkpReply('ALT-003', 'https://apartqn.com', 'vi')).toBe('Chào bạn! Căn ALT-003 còn trống. Xem đủ ảnh, chi phí hằng tháng và đặt lịch xem tại: https://apartqn.com/c/alt-003?s=mkp');
    expect(mkpReply('ALT-003', 'https://apartqn.com', 'en')).toContain('https://apartqn.com/c/alt-003?s=mkp');
  });
});
