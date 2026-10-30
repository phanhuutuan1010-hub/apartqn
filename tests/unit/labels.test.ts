import { describe, expect, it } from 'vitest';
import vi from '@/i18n/vi.json';
import en from '@/i18n/en.json';
import ru from '@/i18n/ru.json';
import { AMENITIES, AMENITY_LABEL, FEATURE_LABEL, FURNITURE_LABEL, UT_LABEL, VIEW_LABEL } from '@/lib/admin/labels';
import { FEATURES, FURNITURE, VIEWS } from '@/lib/unitTypes';

/** Admin labels are inlined (no i18n import in client bundles) — they must match the site's Vietnamese strings. */
describe('admin labels = vi.json', () => {
  const dict = vi as Record<string, string>;
  it.each([['b_', AMENITY_LABEL], ['ut_', UT_LABEL], ['f_', FEATURE_LABEL], ['vw_', VIEW_LABEL], ['fu_', FURNITURE_LABEL]] as const)('%s*', (prefix, map) => {
    for (const [k, v] of Object.entries(map)) expect(v).toBe(dict[prefix + k]);
  });
  it('every structured value has a label in every language', () => {
    for (const d of [vi, en, ru] as Record<string, string>[]) {
      for (const k of AMENITIES) expect(d[`b_${k}`], `b_${k}`).toBeTruthy();
      for (const k of FEATURES) expect(d[`f_${k}`], `f_${k}`).toBeTruthy();
      for (const k of VIEWS) expect(d[`vw_${k}`], `vw_${k}`).toBeTruthy();
      for (const k of FURNITURE) expect(d[`fu_${k}`], `fu_${k}`).toBeTruthy();
    }
  });
});

describe('every public string exists in every language', () => {
  it('vi, en and ru have exactly the same keys, none empty', () => {
    const keys = Object.keys(vi).sort();
    expect(Object.keys(en).sort()).toEqual(keys);
    expect(Object.keys(ru).sort()).toEqual(keys);
    for (const d of [vi, en, ru] as Record<string, string>[]) for (const k of keys) expect(d[k].trim(), k).not.toBe('');
  });
  it('Russian copy never says "N-комнатная" (Russians count the living room)', () => {
    expect(Object.values(ru).join('\n')).not.toMatch(/комнатн/);
  });
});
