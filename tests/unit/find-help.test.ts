import { describe, expect, it } from 'vitest';
import en from '@/i18n/en.json';
import { criteriaLine, criteriaParts, findHelpMessage } from '@/lib/search/criteriaLine';
import { plainT, tVi } from '@/lib/i18nPlain';

const tEn = plainT(en as Record<string, unknown>);

describe('find-help message', () => {
  const c = { b: 'altara', t: '2pn', pmax: '12.5', ft: ['sea_view', 'pets_ok'] };

  it('vi: query + criteria, nothing else', () => {
    expect(findHelpMessage(tVi, 'gần biển', criteriaParts(c, tVi, ',', 'Altara'))).toBe(
      'Chào ApartQN, tôi cần tìm căn hộ: “gần biển” · Altara · 2PN · ≤ 12,5 triệu · View biển · Cho nuôi thú cưng. Nhờ tìm giúp tôi.',
    );
  });

  it('en wording and order; "near the sea" unless sea view is already asked', () => {
    expect(findHelpMessage(tEn, '', criteriaParts({ t: '01', pmax: '10', near: 'sea' }, tEn, '.'))).toBe(
      "Hi ApartQN, I'm looking for an apartment: studio / 1 bedroom · ≤ 10 million VND · near the sea. Could you help me find one?",
    );
    expect(criteriaParts({ near: 'sea', ft: ['sea_view'] }, tEn, '.')).toEqual(['Sea view']);
  });

  it('empty search → generic message', () => {
    expect(findHelpMessage(tVi, ' ', [])).toBe('Chào ApartQN, tôi cần tìm căn hộ. Nhờ tìm giúp tôi.');
  });

  it('staff line (Vietnamese) keeps the free text', () => {
    expect(criteriaLine({ t: 'studio', q: 'chợ' }, tVi)).toBe('Studio · “chợ”');
  });
});
