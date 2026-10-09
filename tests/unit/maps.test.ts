import { describe, expect, it } from 'vitest';
import { coordsFromMapsUrl, mapsUrlOk } from '@/lib/maps';

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
