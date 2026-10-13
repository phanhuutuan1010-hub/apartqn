import { describe, expect, it } from 'vitest';
import { fmtPhone, isVnMobile, telHref, tgHref, toLocal, waHref, zaloHref } from '@/lib/phone';
import { contactLinks, contacts } from '@/lib/contacts';

describe('VN phone helpers', () => {
  it('normalises +84 / 84 / dots / spaces', () => {
    expect(toLocal('+84 905 123 456')).toBe('0905123456');
    expect(toLocal('84905123456')).toBe('0905123456');
    expect(toLocal('0905.123.456')).toBe('0905123456');
  });
  it('formats in groups', () => {
    expect(fmtPhone('0905123456')).toBe('0905 123 456');
    expect(fmtPhone('+84 905 123 456')).toBe('0905 123 456');
    expect(fmtPhone('02563812345')).toBe('0256 381 2345');
    expect(fmtPhone('1900 1234')).toBe('1900 1234');
  });
  it('links', () => {
    expect(telHref('0905 123 456')).toBe('tel:+84905123456');
    expect(telHref('19001234')).toBe('tel:19001234');
    expect(zaloHref('+84 905 123 456')).toBe('https://zalo.me/0905123456');
    expect(waHref('0905123456')).toBe('https://wa.me/84905123456');
    expect(waHref('1900 1234')).toBeNull();
    expect(tgHref('0906051010')).toBe('https://t.me/+84906051010');
    expect(tgHref('0906051010', '@apartqn')).toBe('https://t.me/apartqn');
    expect(tgHref(undefined, '')).toBeNull();
  });
  it('site contact buttons: settings numbers per locale, prefilled message, nothing made up', () => {
    const c = { hotline: '0363480154', zalo: '0906051010', whatsapp: '0906051010', telegramPhone: '0906051010' };
    expect(fmtPhone(c.hotline)).toBe('0363 480 154');
    expect(fmtPhone(c.zalo)).toBe('0906 051 010');
    expect(contacts(c, 'vi', 'Gọi').map((x) => x.href)).toEqual(['https://zalo.me/0906051010', 'tel:+84363480154']);
    const [wa, tg] = contacts(c, 'en', 'Call', { code: 'ALT-001' });
    expect(wa.href).toMatch(/^https:\/\/wa\.me\/84906051010\?text=.*ALT-001/);
    expect(tg.href).toMatch(/^https:\/\/t\.me\/\+84906051010\?text=.*ALT-001/);
    expect(contactLinks({ ...c, telegramUsername: 'apartqn' }, 'Call', 'hi').telegram?.href).toBe('https://t.me/apartqn?text=hi');
    expect(contacts({}, 'en', 'Call')).toEqual([]);
  });
  it('mobile validation', () => {
    for (const ok of ['0905123456', '+84 905 123 456', '0389 999 000', '0705.111.222']) expect(isVnMobile(ok)).toBe(true);
    for (const bad of ['0123456789', '090512345', '1900 1234', '0905 123 4567', 'abc']) expect(isVnMobile(bad)).toBe(false);
  });
});
