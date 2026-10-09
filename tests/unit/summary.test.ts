import { describe, expect, it } from 'vitest';
import { createTranslator } from 'next-intl';
import vi from '@/i18n/vi.json';
import en from '@/i18n/en.json';
import { listingDescription } from '@/lib/summary';
import { toCsv } from '@/lib/admin/csv';
import { consignSchema } from '@/lib/leadSchema';
import type { Listing } from '@/lib/types';

const base: Listing = {
  code: 'QN-001', buildingId: 'altara', floor: 18, area: 68, beds: 2, baths: 2, dir: 'SE', view: 'sea', furn: 'full',
  rent: 13500000, deposit: 2, cycle: 'm1', mgmt: 816000, elec: 'evn', water: 'meter', moto: 150000, car: 1500000, net: 220000,
  minTerm: 6, maxOcc: 4, pets: true, tempReg: true, verified: true, video: false, status: 'available', moveIn: '2026-10-05',
  updated: '2026-09-21', photos: [], thumbs: [], photoCount: 0, desc: { vi: 'Căn góc, view biển đẹp, bếp mới.' }, demo: true,
};
const tr = (locale: 'vi' | 'en', messages: object) =>
  createTranslator({ locale, messages }) as unknown as Parameters<typeof listingDescription>[3];
const VI_CHARS = /[ăâđêôơưàảãáạằẳẵắặầẩẫấậèẻẽéẹềểễếệìỉĩíịòỏõóọồổỗốộờởỡớợùủũúụừửữứựỳỷỹýỵ]/i;

describe('listing description', () => {
  it('vi page shows the owner text', () => {
    expect(listingDescription(base, 'Altara Residences Quy Nhơn', 'vi', tr('vi', vi))).toEqual({ text: base.desc.vi, generated: false });
  });

  it('en without translation → generated summary, never Vietnamese text', () => {
    for (const [l, m] of [['en', en]] as const) {
      const d = listingDescription(base, 'Altara Residences', l, tr(l, m));
      expect(d.generated).toBe(true);
      expect(d.text).not.toContain(base.desc.vi);
      expect(d.text).not.toMatch(VI_CHARS);
      expect(d.text).toMatch(/68 m²/);
      expect(d.text).not.toMatch(/\{|\}/); // all placeholders filled
    }
  });

  it('uses the translation when present', () => {
    const x = { ...base, desc: { ...base.desc, en: 'Corner unit with sea view.' } };
    expect(listingDescription(x, 'Altara', 'en', tr('en', en)).text).toBe('Corner unit with sea view.');
  });

  it('skips missing fields and handles studios', () => {
    const x = { ...base, beds: 0, pets: false, desc: {} };
    const d = listingDescription(x, 'Altara', 'en', tr('en', en)).text;
    expect(d).toMatch(/^Studio apartment at Altara/);
    expect(d).not.toMatch(/Pets/);
  });
});

describe('csv export', () => {
  it('has a UTF-8 BOM, quotes, and neutralises formulas', () => {
    const csv = toCsv([{ name: 'Nguyễn "An"', phone: '+84901', note: '=HYPERLINK("x")', tags: ['a', 'b'] }]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('"Nguyễn ""An"""');
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain("'+84901");
    expect(csv).toContain('"[""a"",""b""]"');
  });
});

describe('consign photo paths', () => {
  const ok = { type: 'consign', rent: '10.000.000', owner: 'An', phone: '0901234567', locale: 'vi' };
  const id = '3f1c2a9e-1111-4222-8333-444455556666';
  it('accepts paths issued by /api/consign/upload', () => {
    expect(consignSchema.safeParse({ ...ok, photos: [`${id}/1.jpg`, `${id}/2.webp`] }).success).toBe(true);
  });
  it('rejects URLs, traversal and mixed uploads', () => {
    for (const photos of [['https://evil.example/a.jpg'], ['../x/1.jpg'], [`${id}/1.jpg`, `aaaaaaaa-1111-4222-8333-444455556666/2.jpg`], [`${id}/1.exe`]]) {
      expect(consignSchema.safeParse({ ...ok, photos }).success).toBe(false);
    }
  });
});
