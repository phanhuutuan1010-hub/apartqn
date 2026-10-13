import { describe, expect, it } from 'vitest';
import { minRent } from '@/lib/minRent';

const x = (rent: number, status = 'available', demo = false) => ({ rent, status, demo }) as Parameters<typeof minRent>[0][number];

describe('lowest rent shown in the bottom bar', () => {
  it('only available, non-demo apartments count', () => {
    expect(minRent([x(15e6), x(9e6, 'rented'), x(8e6, 'reserved'), x(7e6, 'available', true), x(13.5e6)])).toBe(13.5e6);
  });
  it('nothing available → no price', () => {
    expect(minRent([])).toBeNull();
    expect(minRent([x(9e6, 'rented'), x(7e6, 'available', true)])).toBeNull();
  });
});
