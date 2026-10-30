import { describe, expect, it } from 'vitest';
import vi from '@/i18n/vi.json';
import { AMENITY_LABEL, FEATURE_LABEL, UT_LABEL } from '@/lib/admin/labels';

/** Admin labels are inlined (no i18n import in client bundles) — they must match the site's Vietnamese strings. */
describe('admin labels = vi.json', () => {
  const dict = vi as Record<string, string>;
  it.each([['b_', AMENITY_LABEL], ['ut_', UT_LABEL], ['f_', FEATURE_LABEL]] as const)('%s*', (prefix, map) => {
    for (const [k, v] of Object.entries(map)) expect(v).toBe(dict[prefix + k]);
  });
});
