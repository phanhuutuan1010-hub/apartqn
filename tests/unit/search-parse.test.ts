import { describe, expect, it } from 'vitest';
import { parseSearch, type BuildingRef, type Parsed } from '@/lib/search/parse';
import { norm, translit } from '@/lib/search/normalize';
import { editDistance, wordScore } from '@/lib/search/fuzzy';

const B: BuildingRef[] = [
  { slug: 'altara', name: 'Altara Residences Quy Nhơn', aliases: ['Алтара'], prefix: 'ALT' },
  { slug: 'phutai', name: 'Phú Tài Residence', prefix: 'PTC' },
  { slug: 'flc', name: 'FLC Sea Tower Quy Nhơn', prefix: 'FLC' },
  { slug: 'tms', name: 'TMS Luxury Hotel & Residences Quy Nhơn', prefix: 'TMS' },
  { slug: 'hagl', name: 'HAGL Quy Nhơn', prefix: 'HAG' },
  { slug: 'apt', name: 'An Phú Thịnh Garden Tower', prefix: 'APT' },
  { slug: 'thinhphat', name: 'Thịnh Phát Tower', prefix: 'TPT' },
  { slug: 'ecolife', name: 'Ecolife Riverside', prefix: 'ECO' },
];
const M = 1e6;
const p = (q: string, bs = B) => parseSearch(q, bs);
const is = (q: string, want: Partial<Parsed>) => expect(p(q)).toEqual({ text: '', ...want });

describe('normalise', () => {
  it('strips diacritics, đ, ё/й, case and extra spaces', () => {
    expect(norm('  Đường  Trần Hưng Đạo ')).toBe('duong tran hung dao');
    expect(norm('Трёхкомнатная')).toBe('трехкомнатная');
    expect(translit('алтара')).toBe('altara');
  });
  it('edit distance counts a swap as one typo', () => {
    expect(editDistance('atlara', 'altara', 2)).toBe(1);
    expect(wordScore('altra', 'altara')).toBeGreaterThanOrEqual(0.7);
    expect(wordScore('alt', 'altara')).toBe(0.9);
    expect(wordScore('tms', 'tme')).toBe(0); // 3 letters: no typos allowed
  });
});

describe('parseSearch · vi', () => {
  it('building + bedrooms + max price', () => is('Altara 2PN dưới 12tr', { building: 'altara', beds: 2, priceMax: 12 * M }));
  it('no diacritics, furniture + sea view', () => is('can ho 2 phong ngu full noi that view bien', { beds: 2, furniture: 'full', view: 'sea' }));
  it('empty unit + price range in words', () => is('căn hộ 1pn nhà trống từ 6 đến 8 triệu', { beds: 1, furniture: 'empty', priceMin: 6 * M, priceMax: 8 * M }));
  it('dash range + pets', () => is('10-15tr cho nuôi thú cưng', { priceMin: 10 * M, priceMax: 15 * M, pets: true }));
  it('slang "củ" + generic word of the building name', () => is('thinh phat tower trên 10 củ', { building: 'thinhphat', priceMin: 10 * M }));
  it('studio, basic furniture', () => is('studio nội thất cơ bản', { beds: 0, furniture: 'basic' }));
  it('typo in the building name', () => is('atlara 3pn', { building: 'altara', beds: 3 }));
  it('parking, no diacritics', () => is('phu tai residence co cho dau o to', { building: 'phutai', parking: true }));
  it('glued / split building words', () => {
    is('eco life 2pn', { building: 'ecolife', beds: 2 });
    is('thinhphat', { building: 'thinhphat' });
  });
  it('street stays as text', () => is('Trần Hưng Đạo 2pn', { beds: 2, text: 'tran hung dao' }));
  it('city name and filler words are dropped', () => is('cho thuê căn hộ Quy Nhơn giá rẻ', {}));
  it('number words + full VND amount', () => is('hai phòng ngủ dưới 12.000.000đ', { beds: 2, priceMax: 12 * M }));
  it('a bare amount is a budget; area is not money', () => {
    is('1pn 7,5tr', { beds: 1, priceMax: 7.5 * M });
    is('2pn 65m2', { beds: 2, text: '65m2' });
    is('dưới 12', { priceMax: 12 * M });
  });
});

describe('parseSearch · en', () => {
  it('br + furnished + under + sea view', () => is('2br furnished under 12m sea view', { beds: 2, furniture: 'full', priceMax: 12 * M, view: 'sea' }));
  it('unfurnished is not furnished', () => is('2 bed unfurnished pet friendly', { beds: 2, furniture: 'empty', pets: true }));
  it('partly furnished, between … and …', () => is('partly furnished 1 bedroom between 8 and 10 million', { beds: 1, furniture: 'basic', priceMin: 8 * M, priceMax: 10 * M }));
  it('typos: furnised, parkng', () => is('fully furnised flc 2 bedrooms parkng', { furniture: 'full', building: 'flc', beds: 2, parking: true }));
  it('number word + over', () => is('two bedroom apartment in altara over 10m', { beds: 2, building: 'altara', priceMin: 10 * M }));
});

describe('parseSearch · ru', () => {
  it('двушка с мебелью до 12 млн', () => is('двушка с мебелью до 12 млн', { beds: 2, furniture: 'full', priceMax: 12 * M }));
  it('2-комн. без мебели, вид на море', () => is('2-комн. без мебели вид на море', { beds: 2, furniture: 'empty', view: 'sea' }));
  it('range от … до …, pets', () => is('двухкомнатная квартира от 10 до 15 млн можно с животными', { beds: 2, priceMin: 10 * M, priceMax: 15 * M, pets: true }));
  it('Cyrillic alias + parking', () => is('Алтара 1-комнатная с парковкой', { building: 'altara', beds: 1, parking: true }));
  it('однушка частично меблированная', () => is('однушка частично меблированная', { beds: 1, furniture: 'basic' }));
  it('typo: меблированая; city name', () => is('Куинён 3 спальни меблированая', { beds: 3, furniture: 'full' }));
  it('Cyrillic without an alias is transliterated', () => is('хагл', { building: 'hagl' }));
});

describe('parseSearch · codes and ambiguity', () => {
  it('per-building code in any form', () => {
    expect(p('ALT-001')).toEqual({ code: 'ALT-001', text: '' });
    expect(p('alt-1').code).toBe('ALT-001');
    expect(p('alt1').code).toBe('ALT-001');
    expect(p('Flc012').code).toBe('FLC-012');
    expect(p('tms-1234').code).toBe('TMS-1234');
    expect(p('xem căn ptc-5 giúp tôi').code).toBe('PTC-005'); // known prefix inside a sentence
    expect(p('abc-12', []).code).toBe('ABC-012'); // the whole query looks like a code
    expect(p('xem bed2 nhé').code).toBeUndefined(); // "bed" is not a building prefix
  });
  it('old QN codes are kept as legacyCode', () => {
    expect(p('QN-012')).toEqual({ legacyCode: 'QN-012', text: '' });
    expect(p('qn12').legacyCode).toBe('QN-012');
    expect(p('xem căn qn 7').legacyCode).toBe('QN-007');
    expect(p('qn-1').legacyCode).toBe('QN-001');
  });
  it('a bare prefix names its building', () => is('ptc 2pn', { building: 'phutai', beds: 2 }));
  it('two buildings named equally well → no building, text kept', () => {
    const bs = [{ slug: 'sa', name: 'Sunrise A' }, { slug: 'sb', name: 'Sunrise B' }];
    expect(p('sunrise 2pn', bs)).toEqual({ beds: 2, text: 'sunrise' });
  });
  it('two-letter prefix does not pick a building', () => expect(p('al').building).toBeUndefined());
  it('quick chips of every locale parse', () => {
    expect(p('2 phòng ngủ').beds).toBe(2);
    expect(p('View biển').view).toBe('sea');
    expect(p('Cho nuôi thú cưng').pets).toBe(true);
    expect(p('2 bedrooms').beds).toBe(2);
    expect(p('Sea view').view).toBe('sea');
    expect(p('Pet friendly').pets).toBe(true);
    expect(p('2 спальни').beds).toBe(2);
    expect(p('Вид на море').view).toBe('sea');
    expect(p('Можно с животными').pets).toBe(true);
  });
});
