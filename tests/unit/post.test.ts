import { describe, expect, it } from 'vitest';
import { buildPost, type PostData } from '@/lib/listing/post';

const L: PostData = {
  code: 'ALT-001', building: 'Altara Residences', beds: 2, area: 68, floorBand: 'high', furn: 'full',
  rent: 13_500_000, mgmt: 822_800, mgmtPaidBy: 'tenant', moveIn: '2026-10-20', url: 'https://apartqn.vercel.app/can-ho/alt-001',
};
const today = '2026-10-09';

describe('Tạo bài đăng', () => {
  it('Facebook vi: every listed field, hotline and link', () => {
    const t = buildPost(L, { channel: 'facebook', lang: 'vi', phone: '0363 480 154', today });
    expect(t).toContain('🏢 CHO THUÊ CĂN HỘ 2 PN · Altara Residences');
    expect(t).toContain('• Mã căn: ALT-001');
    expect(t).toContain('• Diện tích 68 m² · Tầng cao');
    expect(t).toContain('• Nội thất đầy đủ');
    expect(t).toContain('• Giá thuê: 13.500.000 đ/tháng');
    expect(t).toContain('• Phí quản lý: 822.800 đ/tháng (khách trả)');
    expect(t).toContain('• Dọn vào từ 20/10');
    expect(t).toContain('📞 Liên hệ: 0363 480 154');
    expect(t).toContain('🔗 https://apartqn.vercel.app/can-ho/alt-001');
  });

  it('Zalo is short (few lines) and keeps code, price, phone, link', () => {
    const t = buildPost(L, { channel: 'zalo', lang: 'vi', phone: '0900', today });
    expect(t.split('\n').length).toBeLessThanOrEqual(5);
    expect(t).toMatch(/^Cho thuê ALT-001 · Altara Residences — 2 PN · 68 m² · Tầng cao · Nội thất đầy đủ · 13\.500\.000 đ\/tháng/);
    expect(t).toContain('LH: 0900');
    expect(t).toContain('https://apartqn.vercel.app/can-ho/alt-001');
  });

  it('English templates', () => {
    const fb = buildPost(L, { channel: 'facebook', lang: 'en', phone: '+84 900', today });
    expect(fb).toContain('🏢 APARTMENT FOR RENT 2 bedrooms · Altara Residences');
    expect(fb).toContain('• Rent: 13,500,000 VND/month');
    expect(fb).toContain('• Management fee: 822,800 VND/month (tenant)');
    expect(fb).toContain('• Available from 20 Oct');
    expect(buildPost({ ...L, beds: 1 }, { channel: 'zalo', lang: 'en', phone: '', today })).toMatch(/^For rent: ALT-001 · Altara Residences — 1 bedroom/);
  });

  it('skips empty fields and never prints placeholders', () => {
    const t = buildPost({ ...L, area: null, floorBand: null, furn: null, mgmt: null, mgmtPaidBy: null, moveIn: null, url: null }, { channel: 'facebook', lang: 'vi', phone: '', today });
    expect(t).not.toMatch(/Diện tích|Tầng|Nội thất|Phí quản lý|Dọn vào|🔗|📞|undefined|null|NaN/);
    expect(t).toContain('• Giá thuê: 13.500.000 đ/tháng');
  });

  it('owner pays the management fee; move-in in the past = available now', () => {
    const t = buildPost({ ...L, mgmtPaidBy: 'owner', moveIn: '2026-10-01' }, { channel: 'facebook', lang: 'vi', phone: '1', today });
    expect(t).toContain('• Phí quản lý: chủ nhà trả');
    expect(t).not.toContain('822.800');
    expect(t).toContain('• Dọn vào ngay');
  });

  it('studio, unpublished (no link)', () => {
    const t = buildPost({ ...L, beds: 0, code: null, url: null }, { channel: 'zalo', lang: 'vi', phone: '0900', today });
    expect(t).toMatch(/^Cho thuê · Altara Residences — Studio/);
    expect(t).not.toContain('http');
  });
});

describe('Tạo bài đăng EN excerpt', () => {
  const base = { code: 'ALT-001', building: 'Altara', beds: 2, area: 68, floorBand: null, furn: 'full' as const, rent: 13_500_000, mgmt: null, mgmtPaidBy: null, moveIn: null, url: null };
  it('EN Facebook includes the translated excerpt; VI and Zalo do not', () => {
    const d = { ...base, excerptEn: 'Bright corner unit with sea view.' };
    expect(buildPost(d, { channel: 'facebook', lang: 'en', phone: '0905' })).toContain('Bright corner unit with sea view.');
    expect(buildPost(d, { channel: 'facebook', lang: 'vi', phone: '0905' })).not.toContain('Bright corner');
    expect(buildPost(d, { channel: 'zalo', lang: 'en', phone: '0905' })).not.toContain('Bright corner');
  });
  it('no excerpt → structured fields only', () => expect(buildPost(base, { channel: 'facebook', lang: 'en', phone: '' })).not.toMatch(/undefined|null/));
});

describe('public wording: floor band + move-in', () => {
  it('never prints a floor number; EN date is "5 Nov"', () => {
    const t = buildPost({ ...L, moveIn: '2026-11-05' }, { channel: 'facebook', lang: 'en', phone: '', today });
    expect(t).toContain('High floor');
    expect(t).toContain('Available from 5 Nov');
    expect(t).not.toMatch(/Floor 18|thg/);
  });
});
