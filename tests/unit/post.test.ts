import { describe, expect, it } from 'vitest';
import { buildPost, hooksFor, shortLink, type PostData } from '@/lib/listing/post';
import { utmFromCookie } from '@/lib/attribution';

const L: PostData = {
  code: 'ALT-001', building: 'Altara Residences', beds: 2, floorBand: 'high', furn: 'full', view: 'sea',
  rent: 13_500_000, moveIn: '2026-10-01', photoCount: 9, ownPhotos: true, published: true,
};
const o = { origin: 'https://apartqn.com', today: '2026-10-13' };
const lines = (s: string) => s.split('\n\n').map((b) => b.split('\n'));

describe('Tạo bài đăng v2', () => {
  it('Facebook VI/EN with photos: two blocks of at most 4 lines, city in the hook, short link, hashtags, no phone', () => {
    const p = buildPost(L, { ...o, channel: 'facebook', pair: 'vi-en', mode: 'img', hook: 'price' });
    const [vi, en, tags] = lines(p.text);
    expect(vi).toEqual([
      '🏠 2 phòng ngủ · Altara Residences, Quy Nhơn — chỉ 13.500.000 đ/tháng',
      'Dọn vào ngay · Tầng cao',
      '📸 9 ảnh thực tế + chi phí hằng tháng chi tiết',
      '👉 https://apartqn.com/c/alt-001?s=fb&v=img&l=vi-en',
    ]);
    expect(en[0]).toBe('🏠 2-bedroom · Altara Residences, Quy Nhon — only 13,500,000 VND/month');
    expect(en[1]).toBe('Available now · High floor');
    expect(en.length).toBeLessThanOrEqual(4);
    expect(tags).toEqual(['#ApartQN #QuyNhon #ChoThueCanHo #QuyNhonApartment']);
    expect(p.text).not.toMatch(/\b0\d{9}\b|📞|Tầng \d|Floor \d|undefined|null/);
    expect(p.comment).toBeUndefined();
  });

  it('link in the first comment: no link in the post, a separate comment line', () => {
    const p = buildPost(L, { ...o, channel: 'facebook', pair: 'vi-en', mode: 'comment', hook: 'price' });
    expect(p.text).not.toContain('/c/alt-001');
    expect(p.comment).toBe('👉 https://apartqn.com/c/alt-001?s=fb&v=comment&l=vi-en');
    expect(lines(p.text)[0]).toHaveLength(3);
  });

  it('hooks rotate: feature-first only with a stored feature; move-in-first leads with the date', () => {
    expect(hooksFor(L)).toEqual(['price', 'feature', 'move']);
    expect(hooksFor({ ...L, view: 'city', furn: 'basic', floorBand: 'mid' })).toEqual(['price', 'move']);
    const f = buildPost(L, { ...o, channel: 'facebook', hook: 'feature' });
    expect(lines(f.text)[0].slice(0, 2)).toEqual(['🌊 View biển · 2 phòng ngủ · Altara Residences, Quy Nhơn', '💰 13.500.000 đ/tháng · Dọn vào ngay']);
    const m = buildPost({ ...L, moveIn: '2026-11-05' }, { ...o, channel: 'facebook', hook: 'move' });
    expect(lines(m.text)[0][0]).toBe('🔑 Dọn vào từ 05/11 · 2 phòng ngủ · Altara Residences, Quy Nhơn');
    expect(lines(m.text)[1][0]).toBe('🔑 Available from 5 Nov · 2-bedroom · Altara Residences, Quy Nhon');
    // a hook the listing cannot use falls back to the first usable one
    expect(buildPost({ ...L, view: null, furn: null, floorBand: null }, { ...o, channel: 'facebook', hook: 'feature' }).text).toMatch(/^🏠/);
  });

  it('RU/EN: Russian block from templates, city in Russian, link lands on the English page pair', () => {
    const p = buildPost(L, { ...o, channel: 'facebook', pair: 'ru-en', mode: 'link', hook: 'price' });
    const [ru, en, tags] = lines(p.text);
    expect(ru[0]).toBe('🏠 2 спальни · Altara Residences, Куинён — всего 13 500 000 VND/мес.');
    expect(ru[1]).toBe('Заезд сразу · Высокий этаж');
    expect(ru[2]).toBe('📸 9 реальных фото + подробные ежемесячные расходы');
    expect(ru[3]).toBe('👉 https://apartqn.com/c/alt-001?s=fb&v=link&l=ru-en');
    expect(en[0]).toContain('Quy Nhon');
    expect(tags[0]).toBe('#ApartQN #QuyNhon #АрендаКвартиры #Куинён');
  });

  it('Zalo: Vietnamese only, 2 lines (hook with the city + short link)', () => {
    const p = buildPost(L, { ...o, channel: 'zalo', hook: 'price' });
    expect(p.text.split('\n')).toEqual(['🏠 2 phòng ngủ · Altara Residences, Quy Nhơn — chỉ 13.500.000 đ/tháng', '👉 https://apartqn.com/c/alt-001?s=zalo&v=link&l=vi-en']);
  });

  it('the city is not repeated when the building name already has it; empty fields are skipped', () => {
    const p = buildPost({ ...L, building: 'HAGL Quy Nhơn', photoCount: 0, ownPhotos: false, floorBand: null }, { ...o, channel: 'facebook', hook: 'price' });
    const [vi, en] = lines(p.text);
    expect(vi[0]).toBe('🏠 2 phòng ngủ · HAGL Quy Nhơn — chỉ 13.500.000 đ/tháng');
    expect(en[0]).not.toContain('Quy Nhon');
    expect(vi[1]).toBe('Dọn vào ngay');
    expect(vi[2]).toBe('📋 Chi phí hằng tháng chi tiết ở trang căn hộ');
    expect(buildPost({ ...L, photoCount: 5, ownPhotos: false }, { ...o, channel: 'facebook' }).text).toContain('📸 5 ảnh + chi phí');
  });
});

describe('short link + attribution', () => {
  it('link carries source, post form and language pair', () => {
    expect(shortLink('https://x.vn/', 'ALT-001', 'facebook', 'comment', 'ru-en')).toBe('https://x.vn/c/alt-001?s=fb&v=comment&l=ru-en');
  });
  it('first-touch cookie → utm fields; anything malformed is ignored', () => {
    expect(utmFromCookie('a=1; aqn_ft=fb.img.vi-en.ALT-001; b=2')).toEqual({ utm_source: 'facebook', utm_medium: 'social', utm_campaign: 'post', utm_content: 'ALT-001_img_vi-en' });
    expect(utmFromCookie('aqn_ft=zalo.link.vi-en.TMS-012').utm_source).toBe('zalo');
    expect(utmFromCookie('aqn_ft=mkp.link.vi-en.ALT-003').utm_source).toBe('marketplace');
    expect(utmFromCookie('aqn_ft=evil.img.vi-en.ALT-001')).toEqual({});
    expect(utmFromCookie(null)).toEqual({});
  });
});
