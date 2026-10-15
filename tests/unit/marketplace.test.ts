import { describe, expect, it } from 'vitest';
import { mkpDescription, mkpFields, mkpLink, mkpReply, mkpSuggestLang, mkpTitle, shortBuilding, type MkpData } from '@/lib/listing/marketplace';

const d: MkpData = { code: 'ALT-003', building: 'Altara Residences', street: '76 Trần Hưng Đạo', beds: 2, baths: 2, area: 61, rent: 13000000, moveIn: '2026-10-01',
  floorBand: 'mid', furn: 'full', pets: false, carParking: true, view: 'sea', minTerm: 6, deposit: 2 };
const today = '2026-10-14';

describe('Facebook Marketplace kit', () => {
  it('main language: sea view + fully furnished → RU, otherwise VI', () => {
    expect(mkpSuggestLang(d)).toBe('ru');
    expect(mkpSuggestLang({ ...d, furn: 'basic' })).toBe('vi');
    expect(mkpSuggestLang({ ...d, view: 'city' })).toBe('vi');
  });

  it('title per language: data-driven, floor band only, never over 100 characters', () => {
    expect(mkpTitle(d, 'vi')).toBe('Altara 2PN · Tầng trung · Quy Nhơn | ApartQN ALT-003');
    expect(mkpTitle(d, 'ru')).toBe('Аренда · 2 спальни · вид на море · Altara Residences, Куинён | ApartQN ALT-003');
    expect(mkpTitle(d, 'en')).toBe('2BR for rent · Sea view · Altara Residences, Quy Nhon | ApartQN ALT-003');
    // sea view only when stored; studio; no floor band
    expect(mkpTitle({ ...d, view: 'city', beds: 0 }, 'ru')).toBe('Аренда · Студия · Altara Residences, Куинён | ApartQN ALT-003');
    expect(mkpTitle({ ...d, view: 'river', beds: 1 }, 'en')).toBe('1BR for rent · Altara Residences, Quy Nhon | ApartQN ALT-003');
    expect(mkpTitle({ ...d, beds: 0, floorBand: null })).toBe('Altara Studio · Quy Nhơn | ApartQN ALT-003');
    expect(mkpTitle({ ...d, beds: 5 }, 'ru')).toContain('5 спален');
    for (const t of [mkpTitle(d, 'ru'), mkpTitle(d, 'vi')]) expect(t).not.toMatch(/комнатн|tầng \d/i);
  });

  it('title over 100: optional parts go first, then the building name gives way', () => {
    for (const l of ['vi', 'ru', 'en'] as const) {
      const t = mkpTitle({ ...d, building: 'Khu căn hộ cao cấp ven biển '.repeat(6) }, l);
      expect(t.length, l).toBeLessThanOrEqual(100);
      expect(t, l).toContain('…');
      expect(t, l).not.toMatch(/Tầng trung|вид на море|Sea view/);
      expect(t.endsWith('| ApartQN ALT-003'), l).toBe(true);
    }
    // just over: the sea view is dropped, the full name stays
    const b = 'B'.repeat(100 - ' · 2BR for rent · , Quy Nhon | ApartQN ALT-003'.length + 2);
    const en = mkpTitle({ ...d, building: b }, 'en');
    expect(en).toBe(`2BR for rent · ${b}, Quy Nhon | ApartQN ALT-003`);
  });

  it('fields in the form order: plain rent number, location without unit or floor, a date not in the past, stored amenities only', () => {
    const f = mkpFields(d, today);
    expect(f.map((x) => x.label)).toEqual(['Loại tài sản', 'Số phòng ngủ', 'Số phòng tắm', 'Giá/tháng (VND)', 'Vị trí gợi ý', 'Diện tích (m²)', 'Ngày có sẵn', 'Chỗ đậu xe']);
    expect(f[3].value).toBe('13000000');
    expect(f[4].value).toBe('Altara Residences, 76 Trần Hưng Đạo, Quy Nhơn');
    expect(f[6].value).toBe('14/10/2026');
    expect(mkpFields({ ...d, moveIn: '2026-11-05', pets: true, carParking: null }, today).slice(6).map((x) => x.value)).toEqual(['05/11/2026', 'Cho phép nuôi thú cưng']);
  });

  it('description: three short blocks, main language first, last line the plain short address', () => {
    const ru = mkpDescription(d, 'ru', today).split('\n\n');
    expect(ru).toEqual([
      'Долгосрочная аренда · 2 спальни · 61 м² · Altara Residences, Куинён\n13 000 000 VND/мес. · Заезд сразу · от 6 месяцев\nВид на море · Полностью меблирована · Стиральная машина',
      'Long-term rental · 2 bedrooms · 61 m² · Altara Residences, Quy Nhon\n13,000,000 VND/month · Available now · min. 6 months\nSea view · Fully furnished · Washing machine',
      'Cho thuê dài hạn · 2 phòng ngủ · 61 m² · Altara Residences, Quy Nhơn\n13.000.000 đ/tháng · Dọn vào ngay · thuê tối thiểu 6 tháng\nView biển · Nội thất đầy đủ · Máy giặt',
      'apartqn.com/ALT-003',
    ]);
    const lead = (l: 'vi' | 'ru' | 'en') => mkpDescription(d, l, today).split('\n\n').map((b) => b.slice(0, 4));
    expect(lead('vi')).toEqual(['Cho ', 'Long', 'Долг', 'apar']);
    expect(lead('en')).toEqual(['Long', 'Cho ', 'Долг', 'apar']);
  });

  it('description: stored fields only — no view, no term, basic furniture, pets, deposit, later move-in', () => {
    const x = { ...d, view: 'city' as const, minTerm: null, furn: 'basic' as const, pets: true, moveIn: '2026-11-05' };
    const [ru, en, vi] = mkpDescription(x, 'ru', today).split('\n\n');
    expect(ru.split('\n').slice(1)).toEqual(['13 000 000 VND/мес. · Заезд с 05.11', 'Оборудованная кухня · Можно с животными · Депозит 2 мес.']);
    expect(en.split('\n')[1]).toBe('13,000,000 VND/month · Available from 5 Nov');
    expect(vi.split('\n')[2]).toBe('Bếp đầy đủ dụng cụ · Cho nuôi thú cưng · Cọc 2 tháng');
    for (const l of ['vi', 'ru', 'en'] as const) {
      const t = mkpDescription(x, l, today);
      expect(t).not.toMatch(/https?:|www\.|\?s=|\d{9,}|комнатн/);
      expect(t.split('\n').at(-1)).toBe('apartqn.com/ALT-003');
      for (const b of t.split('\n\n').slice(0, 3)) expect(b.split('\n').length).toBeLessThanOrEqual(3);
    }
  });

  it('Messenger replies (VI / EN / RU) carry the counted short link', () => {
    expect(mkpLink('https://apartqn.com/', 'ALT-003')).toBe('https://apartqn.com/ALT-003?s=mkp');
    expect(mkpReply('ALT-003', 'https://apartqn.com', 'vi')).toBe('Chào bạn! Căn ALT-003 còn trống. Xem đủ ảnh, chi phí hằng tháng và đặt lịch xem tại: https://apartqn.com/ALT-003?s=mkp');
    expect(mkpReply('ALT-003', 'https://apartqn.com', 'en')).toContain('https://apartqn.com/ALT-003?s=mkp');
    expect(mkpReply('ALT-003', 'https://apartqn.com', 'ru')).toBe('Здравствуйте! Квартира ALT-003 свободна. Все фото, ежемесячные расходы и запись на просмотр: https://apartqn.com/ALT-003?s=mkp');
  });

  it('short building name', () => {
    expect(shortBuilding('FLC Sea Tower')).toBe('FLC Sea');
    expect(shortBuilding('Residences')).toBe('Residences');
  });
});
