import { describe, expect, it } from 'vitest';
import { enPath, firstLanguage, visitorLocale } from '@/lib/localeDetect';

const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';

describe('home page language', () => {
  it('reads the most preferred tag', () => {
    expect(firstLanguage('vi-VN,vi;q=0.9,en;q=0.8')).toBe('vi-vn');
    expect(firstLanguage('en;q=0.5, vi;q=0.9')).toBe('vi');
    expect(firstLanguage('*')).toBeNull();
    expect(firstLanguage(null)).toBeNull();
  });
  it('Vietnamese browsers stay, everyone else goes to English', () => {
    expect(visitorLocale({ acceptLanguage: 'vi-VN,vi;q=0.9', userAgent: CHROME })).toEqual({ locale: 'vi', remember: true });
    expect(visitorLocale({ acceptLanguage: 'en-US,en;q=0.9,vi;q=0.8', userAgent: CHROME })).toEqual({ locale: 'en', remember: true });
    expect(visitorLocale({ acceptLanguage: 'ru-RU', userAgent: CHROME })).toEqual({ locale: 'en', remember: true });
    expect(visitorLocale({ userAgent: CHROME })).toEqual({ locale: 'en', remember: true });
    expect(visitorLocale({})).toEqual({ locale: 'en', remember: true });
  });
  it('a stored choice wins over the browser language', () => {
    expect(visitorLocale({ cookie: 'en', acceptLanguage: 'vi-VN', userAgent: CHROME })).toEqual({ locale: 'en', remember: false });
    expect(visitorLocale({ cookie: 'vi', acceptLanguage: 'en-US', userAgent: CHROME })).toEqual({ locale: 'vi', remember: false });
    expect(visitorLocale({ cookie: 'xx', acceptLanguage: 'vi', userAgent: CHROME })).toEqual({ locale: 'vi', remember: true });
  });
  it('crawlers and link previews are never redirected', () => {
    for (const ua of ['Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'Mozilla/5.0 (compatible; bingbot/2.0)', 'Mozilla/5.0 (compatible; YandexBot/3.0)',
      'facebookexternalhit/1.1', 'Mozilla/5.0 (compatible; Zalo/1.0)', 'TelegramBot (like TwitterBot)', 'WhatsApp/2.23', 'SomeNewBot/1.0']) {
      expect(visitorLocale({ acceptLanguage: 'en-US', userAgent: ua })).toBeNull();
      expect(visitorLocale({ cookie: 'en', userAgent: ua })).toBeNull();
    }
  });
  it('English twin of a Vietnamese path', () => {
    expect(enPath('/')).toBe('/en');
    expect(enPath('/can-ho')).toBe('/en/apartments');
    expect(enPath('/can-ho/alt-001')).toBe('/en/apartments/alt-001');
    expect(enPath('/toa-nha/altara')).toBe('/en/buildings/altara');
    expect(enPath('/ky-gui')).toBe('/en/list-your-apartment');
    expect(enPath('/khong-co-trang-nay')).toBe('/en');
    expect(enPath('/can-ho/a/b')).toBe('/en');
  });
});
