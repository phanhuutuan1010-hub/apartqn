import { describe, expect, it } from 'vitest';
import { coordsFromMapsUrl, mapsEmbedUrl, mapsOpenUrl, mapsUrlOk } from '@/lib/maps';

describe('Google Maps link → coordinates (only what the link says)', () => {
  it('place link: the pin (!3d!4d), not the map centre', () =>
    expect(coordsFromMapsUrl('https://www.google.com/maps/place/Chung+c%C6%B0+Altara/@13.7736485,109.2407732,20z/data=!4m6!3m5!1s0x316f6d1626651d9b:0xc5fcefa2470a1777!8m2!3d13.7737623!4d109.2412109!16s%2Fg%2F11qr3psq76?entry=tts'))
      .toEqual({ lat: 13.7737623, lng: 109.2412109 }));
  it('explicit point', () => {
    expect(coordsFromMapsUrl('https://maps.google.com/?q=13.77328,109.24145')).toEqual({ lat: 13.77328, lng: 109.24145 });
    expect(coordsFromMapsUrl('https://www.google.com/maps/place/13.77328,109.24145')).toEqual({ lat: 13.77328, lng: 109.24145 });
  });
  it('map centre only when zoomed in close', () => {
    expect(coordsFromMapsUrl('https://www.google.com/maps/@13.7736,109.2407,18z')).toEqual({ lat: 13.7736, lng: 109.2407 });
    expect(coordsFromMapsUrl('https://www.google.com/maps/@13.7736,109.2407,12z')).toBeNull();
  });
  it('no coordinates → null (short link before resolving, search by name)', () => {
    expect(coordsFromMapsUrl('https://maps.app.goo.gl/VLBPnPyxDwvRKp4d6')).toBeNull();
    expect(coordsFromMapsUrl('https://www.google.com/maps/search/Altara+Quy+Nhon')).toBeNull();
  });
  it('accepts only https Google Maps links', () => {
    expect(mapsUrlOk('https://maps.app.goo.gl/VLBPnPyxDwvRKp4d6')).toBe(true);
    expect(mapsUrlOk('https://www.google.com/maps/place/x')).toBe(true);
    expect(mapsUrlOk('https://www.google.com/search?q=x')).toBe(false);
    expect(mapsUrlOk('http://maps.app.goo.gl/x')).toBe(false);
    expect(mapsUrlOk('https://evil.example/maps.app.goo.gl')).toBe(false);
    expect(mapsUrlOk('https://google.com.evil.io/maps')).toBe(false);
  });
});

describe('embed / open URLs', () => {
  it('coordinates → pin', () => {
    expect(mapsEmbedUrl({ lat: 13.77376, lng: 109.24121, name: 'Altara' }, 'en')).toBe('https://www.google.com/maps?q=13.77376%2C109.24121&z=16&hl=en&output=embed');
    expect(mapsOpenUrl({ lat: 13.77376, lng: 109.24121, name: 'Altara' })).toBe('https://www.google.com/maps/search/?api=1&query=13.77376%2C109.24121');
  });
  it('no coordinates → name + street + city (never invented coordinates)', () => {
    expect(mapsEmbedUrl({ name: 'FLC Sea Tower', street: '1 An Dương Vương' }, 'vi')).toContain('q=FLC%20Sea%20Tower%2C%201%20An%20D');
    expect(mapsOpenUrl({ name: 'TMS', street: '' })).toBe('https://www.google.com/maps/search/?api=1&query=TMS%2C%20Quy%20Nh%C6%A1n');
    expect(mapsOpenUrl({ name: 'FLC Sea Tower Quy Nhơn', street: '' })).toBe('https://www.google.com/maps/search/?api=1&query=FLC%20Sea%20Tower%20Quy%20Nh%C6%A1n');
  });
});
