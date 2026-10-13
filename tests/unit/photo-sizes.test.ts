import { describe, expect, it } from 'vitest';
import { coverScale, coverSizes, scaleSizes } from '@/lib/photoSizes';

describe('sizes for cover-cropped photos', () => {
  it('photos wider than the slot are drawn larger; narrower ones at the slot width', () => {
    expect(coverScale(16 / 9, 4 / 3)).toBe(1.34);
    expect(coverScale(1200 / 508, 4 / 3)).toBe(1.78);
    expect(coverScale(1, 4 / 3)).toBe(1);
    expect(coverScale(3 / 4, 4 / 3)).toBe(1);
    expect(coverScale(undefined, 4 / 3)).toBe(1);
  });
  it('scales every length, keeps the media conditions', () => {
    expect(scaleSizes('(min-width:1024px) 380px, (min-width:768px) 50vw, 100vw', 1)).toBe('(min-width:1024px) 380px, (min-width:768px) 50vw, 100vw');
    expect(scaleSizes('(min-width:1024px) 380px, (min-width:768px) 50vw, 100vw', 1.5)).toBe('(min-width:1024px) calc(380px * 1.5), (min-width:768px) calc(50vw * 1.5), calc(100vw * 1.5)');
  });
  it('per-breakpoint slot shapes', () => {
    const slots = [{ media: '(min-width:768px)', width: '50vw', box: 0.89 }, { width: '100vw', box: 4 / 3 }];
    expect(coverSizes(slots, 1)).toBe('(min-width:768px) calc(50vw * 1.13), 100vw');
    expect(coverSizes(slots)).toBe('(min-width:768px) 50vw, 100vw');
  });
});
