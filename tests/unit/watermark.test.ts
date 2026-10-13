import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { normaliseYoutube, youtubeId } from '@/lib/youtube';
import { publicSuffix, renderMaster, renderVariant, variantWidths, watermarkSvg, WATERMARK } from '@/lib/watermark';

describe('YouTube links', () => {
  it('accepts watch / youtu.be / shorts / mobile, normalises to youtu.be', () => {
    expect(normaliseYoutube('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10')).toBe('https://youtu.be/dQw4w9WgXcQ');
    expect(normaliseYoutube('http://m.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('https://youtu.be/dQw4w9WgXcQ');
    expect(normaliseYoutube('https://youtube.com/shorts/dQw4w9WgXcQ')).toBe('https://youtu.be/dQw4w9WgXcQ');
    expect(youtubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });
  it('rejects other hosts', () => {
    expect(normaliseYoutube('https://vimeo.com/123')).toBeNull();
    expect(normaliseYoutube('https://evil.com/youtu.be/dQw4w9WgXcQ')).toBeNull();
  });
});

describe('watermark render', () => {
  const photo = () => sharp({ create: { width: 2400, height: 1600, channels: 3, background: '#d8d0c0' } }).jpeg().toBuffer();
  it('variant widths: the standard ones below the master, then the master itself; never upscaled', () => {
    expect(variantWidths(4000)).toEqual([640, 1200, 1920]);
    expect(variantWidths(1920)).toEqual([640, 1200, 1920]);
    expect(variantWidths(1024)).toEqual([640, 1024]);
    expect(variantWidths(500)).toEqual([500]);
  });
  it('master: ≤ 2400 px webp, orientation applied, camera metadata gone', async () => {
    const big = await sharp({ create: { width: 4000, height: 3000, channels: 3, background: '#888' } }).jpeg().withExif({ IFD3: { GPSLatitudeRef: 'N' } }).toBuffer();
    const m = await renderMaster(big);
    expect([m.width, m.height]).toEqual([2400, 1800]);
    const meta = await sharp(m.data).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.exif).toBeUndefined();
  });
  it('portrait phone photo: master keeps 2400 px of width; public files come straight from the original without its GPS', async () => {
    const tall = await sharp({ create: { width: 3024, height: 4032, channels: 3, background: '#888' } }).jpeg().withExif({ IFD3: { GPSLatitudeRef: 'N' } }).toBuffer();
    const m = await renderMaster(tall);
    expect([m.width, m.height]).toEqual([2400, 3200]);
    const v = await renderVariant(tall, 1920, true);
    expect([v.width, v.height]).toEqual([1920, 2560]);
    expect((await sharp(v.data).metadata()).exif?.toString('latin1') ?? '').not.toContain('GPS');
  });
  it('1600: logo ~20% wide in the lower third, © metadata', async () => {
    const out = await renderVariant(await photo(), 1600, true);
    expect([out.width, out.height]).toEqual([1600, 1067]);
    const m = await sharp(out.data).metadata();
    expect(m.format).toBe('webp');
    expect(m.xmp?.toString()).toContain(WATERMARK.copyright);
    expect(m.exif).toBeTruthy();
    // the overlay changes pixels only around the logo area
    const plain = await renderVariant(await photo(), 1600, false);
    const diff = async (top: number) => {
      const a = await sharp(out.data).extract({ left: 0, top, width: 1600, height: 40 }).raw().toBuffer();
      const b = await sharp(plain.data).extract({ left: 0, top, width: 1600, height: 40 }).raw().toBuffer();
      let d = 0; for (let i = 0; i < a.length; i++) d += Math.abs(a[i] - b[i]);
      return d / a.length;
    };
    expect(await diff(Math.round(1067 * 0.7) - 20)).toBeGreaterThan(1);
    expect(await diff(40)).toBeLessThan(1);
  });
  it('thumb: logo never narrower than 120 px; svg sized to the image', () => {
    const svg = watermarkSvg(400, 300).toString();
    expect(svg).toContain('width="400" height="300"');
    const scale = Number(/scale\(([\d.]+)\)/.exec(svg)![1]);
    expect(scale * 4113).toBeGreaterThanOrEqual(119.9);
  });
  it('file names carry the variant', () => {
    expect(publicSuffix(true)).toBe(`-wm${WATERMARK.version}`);
    expect(publicSuffix(false)).toBe(`-c${WATERMARK.version}`);
  });
});
