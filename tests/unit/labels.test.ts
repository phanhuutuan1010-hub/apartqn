import { describe, expect, it } from 'vitest';
import vi from '@/i18n/vi.json';
import { AMENITY_LABEL, DIR_LABEL, FURN_LABEL, STATUS_LABEL, VIEW_LABEL } from '@/lib/admin/labels';

/** Admin labels are inlined (no i18n import in client bundles) — they must match the site's Vietnamese strings. */
describe('admin labels = vi.json', () => {
  const dict = vi as Record<string, string>;
  it.each([['d_', DIR_LABEL], ['v_', VIEW_LABEL], ['furn_', FURN_LABEL], ['b_', AMENITY_LABEL]] as const)('%s*', (prefix, map) => {
    for (const [k, v] of Object.entries(map)) expect(v).toBe(dict[prefix + k]);
  });
  it('public statuses', () => {
    expect([STATUS_LABEL.available, STATUS_LABEL.reserved, STATUS_LABEL.rented]).toEqual([vi.st_available, vi.st_reserved, vi.st_rented]);
  });
});
