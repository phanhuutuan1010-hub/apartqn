import { describe, expect, it } from 'vitest';
import { resolveSiteUrl } from '@/data/site';

describe('site origin for absolute URLs', () => {
  it('NEXT_PUBLIC_SITE_URL wins, without a trailing slash', () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: 'https://apartqn.com/' })).toBe('https://apartqn.com');
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: 'https://apartqn-git-x.vercel.app' })).toBe('https://apartqn-git-x.vercel.app');
  });
  it('the retired host and an unset variable in production mean the real domain', () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: 'https://apartqn.vercel.app' })).toBe('https://apartqn.com');
    expect(resolveSiteUrl({ VERCEL_ENV: 'production' })).toBe('https://apartqn.com');
    expect(resolveSiteUrl({})).toBe('http://localhost:3000');
  });
});
