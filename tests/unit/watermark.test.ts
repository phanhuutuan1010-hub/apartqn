import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { normaliseYoutube, youtubeId } from '@/lib/youtube';
import { publicSuffix, renderPublic, watermarkSvg, WATERMARK } from '@/lib/watermark';

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
  it('full: ≤1600, logo ~20% wide in the lower third, © metadata', async () => {
    const out = await renderPublic(await photo(), 'full', true);
    expect([out.width, out.height]).toEqual([1600, 1067]);
    const m = await sharp(out.data).metadata();
    expect(m.format).toBe('webp');
    expect(m.xmp?.toString()).toContain(WATERMARK.copyright);
    expect(m.exif).toBeTruthy();
    // the overlay changes pixels only around the logo area
    const plain = await renderPublic(await photo(), 'full', false);
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
