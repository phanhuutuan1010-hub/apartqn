import { describe, expect, it } from 'vitest';
import { criteriaLine, criteriaParts, findHelpMessage } from '@/lib/search/criteriaLine';

describe('find-help message', () => {
  const c = { b: 'altara', beds: '2', pmin: '8', pmax: '12', fl: 'high', furn: 'full', vw: 'sea', pets: true };

  it('vi: query + criteria, nothing else', () => {
    expect(findHelpMessage('vi', 'gần biển', criteriaParts(c, 'vi', 'Altara'))).toBe(
      'Chào ApartQN, tôi cần tìm căn hộ: “gần biển” · Altara · 2 PN · 8–12 triệu · Tầng cao · Nội thất đầy đủ · View biển · Cho nuôi thú cưng. Nhờ tìm giúp tôi.',
    );
  });

  it('en wording and order', () => {
    expect(findHelpMessage('en', '', criteriaParts({ beds: '1', rent: 'r1', near: 'sea', car: true }, 'en'))).toBe(
      "Hi ApartQN, I'm looking for an apartment: 1 bedroom · 8–12 million VND · near the sea · car parking. Could you help me find one?",
    );
  });

  it('empty search → generic message', () => {
    expect(findHelpMessage('vi', ' ', [])).toBe('Chào ApartQN, tôi cần tìm căn hộ. Nhờ tìm giúp tôi.');
  });

  it('move-in date only on the staff line', () => {
    expect(criteriaParts({ date: '2026-11-05' }, 'vi')).toEqual([]);
    expect(criteriaLine({ beds: '0', date: '2026-11-05', q: 'chợ' })).toBe('Studio · dọn vào trước 05/11/2026 · “chợ”');
  });
});
