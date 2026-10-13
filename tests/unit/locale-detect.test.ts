import { describe, expect, it } from 'vitest';
import { firstLanguage, homeLocale } from '@/lib/localeDetect';

const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';

describe('home page language', () => {
  it('reads the most preferred tag', () => {
    expect(firstLanguage('vi-VN,vi;q=0.9,en;q=0.8')).toBe('vi-vn');
    expect(firstLanguage('en;q=0.5, vi;q=0.9')).toBe('vi');
    expect(firstLanguage('*')).toBeNull();
    expect(firstLanguage(null)).toBeNull();
  });
  it('Vietnamese browsers stay, everyone else goes to English', () => {
    expect(homeLocale({ acceptLanguage: 'vi-VN,vi;q=0.9', userAgent: CHROME })).toEqual({ locale: 'vi', remember: true });
    expect(homeLocale({ acceptLanguage: 'en-US,en;q=0.9,vi;q=0.8', userAgent: CHROME })).toEqual({ locale: 'en', remember: true });
    expect(homeLocale({ acceptLanguage: 'ru-RU', userAgent: CHROME })).toEqual({ locale: 'en', remember: true });
    expect(homeLocale({ userAgent: CHROME })).toEqual({ locale: 'en', remember: true });
    expect(homeLocale({})).toEqual({ locale: 'en', remember: true });
  });
  it('a stored choice wins over the browser language', () => {
    expect(homeLocale({ cookie: 'en', acceptLanguage: 'vi-VN', userAgent: CHROME })).toEqual({ locale: 'en', remember: false });
    expect(homeLocale({ cookie: 'vi', acceptLanguage: 'en-US', userAgent: CHROME })).toEqual({ locale: 'vi', remember: false });
    expect(homeLocale({ cookie: 'xx', acceptLanguage: 'vi', userAgent: CHROME })).toEqual({ locale: 'vi', remember: true });
  });
  it('crawlers and link previews are never redirected', () => {
    for (const ua of ['Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'Mozilla/5.0 (compatible; bingbot/2.0)', 'Mozilla/5.0 (compatible; YandexBot/3.0)',
      'facebookexternalhit/1.1', 'Mozilla/5.0 (compatible; Zalo/1.0)', 'TelegramBot (like TwitterBot)', 'WhatsApp/2.23', 'SomeNewBot/1.0']) {
      expect(homeLocale({ acceptLanguage: 'en-US', userAgent: ua })).toBeNull();
      expect(homeLocale({ cookie: 'en', userAgent: ua })).toBeNull();
    }
  });
});
