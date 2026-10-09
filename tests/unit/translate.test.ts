import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { cleanPasted, copyBlock, excerpt, INSTRUCTION, mismatchText, normVi, numberMismatch, numbersIn } from '@/lib/translate';

describe('copy block', () => {
  it('instruction, glossary, then the Vietnamese text', () => {
    const b = copyBlock('  Căn 2PN full nội thất.  ', [['full nội thất', 'fully furnished'], ['', 'x']]);
    expect(b.startsWith(INSTRUCTION)).toBe(true);
    expect(b).toContain('- full nội thất → fully furnished');
    expect(b).not.toContain('→ x');
    expect(b.endsWith('Vietnamese:\nCăn 2PN full nội thất.')).toBe(true);
  });
});

describe('paste clean-up', () => {
  it.each([
    ['"Fully furnished 2-bedroom."', 'Fully furnished 2-bedroom.'],
    ['“Fully furnished.”', 'Fully furnished.'],
    ['English: Sea view apartment.', 'Sea view apartment.'],
    ["Here's the translation:\n\nSea view.", 'Sea view.'],
    ['**Translation:** Sea view.', 'Sea view.'],
    ['```\nSea view.\n```', 'Sea view.'],
    ['He said "hi" to "them"', 'He said "hi" to "them"'],
  ])('%s', (raw, want) => expect(cleanPasted(raw)).toBe(want));
});

describe('number check', () => {
  it('normalises prices, units and shorthand', () => {
    expect([...numbersIn('Giá 13tr5, 68m2, tầng 16, cọc 2 tháng')]).toEqual([13_500_000, 68, 16, 2]);
    expect([...numbersIn('13.5 million VND, 68 m², 16th floor, 2-month deposit')]).toEqual([13_500_000, 68, 16, 2]);
    expect([...numbersIn('13.500.000 đ · 13,500,000 VND')]).toEqual([13_500_000]);
    expect([...numbersIn('phí 822k')]).toEqual([822_000]);
  });
  it('a faithful translation passes; a changed number is reported', () => {
    const vi = 'Căn 2PN, 68m2, tầng 16, giá 13tr5/tháng, cọc 2 tháng.';
    expect(mismatchText(vi, '2-bedroom, 68 m², 16th floor, 13.5 million VND/month, 2-month deposit.')).toBe('');
    const m = numberMismatch(vi, '2-bedroom, 68 m², 18th floor, 13.5 million VND/month, 2-month deposit.');
    expect(m).toEqual({ onlyVi: ['16'], onlyEn: ['18'] });
    expect(mismatchText(vi, '2-bedroom, 68 m², floor 18.')).toMatch(/chỉ có ở VI: 16, 13\.500\.000; chỉ có ở EN: 18/);
  });
  it('no warning while one side is empty', () => expect(mismatchText('Giá 9tr', '')).toBe(''));
});

describe('source hash normalisation (same as private.vi_hash)', () => {
  it('trims and unifies line ends', () => {
    expect(normVi('  a\r\nb \n')).toBe('a\nb');
    expect(normVi('   ')).toBeNull();
    // node sha256 of the normalised text = encode(sha256(convert_to(…,'UTF8')),'hex') in Postgres
    expect(createHash('sha256').update(normVi('Căn hộ ')!, 'utf8').digest('hex')).toHaveLength(64);
  });
});

describe('excerpt', () => {
  it('whole sentences up to the limit', () => {
    expect(excerpt('Bright corner unit. Sea view from the balcony. Walk to the beach in 5 minutes and more text here.', 50)).toBe('Bright corner unit. Sea view from the balcony.');
    expect(excerpt('short')).toBe('short');
  });
});
