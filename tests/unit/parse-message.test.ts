import { describe, expect, it } from 'vitest';
import { parseMessage, type ParsedMessage } from '@/lib/listing/parseMessage';
import type { BuildingRef } from '@/lib/search/parse';

const B: BuildingRef[] = [
  { slug: 'altara', name: 'Altara Residences Quy Nhơn', aliases: ['Altara', 'Alta'], prefix: 'ALT' },
  { slug: 'phutai', name: 'Phú Tài Residence', prefix: 'PTC' },
  { slug: 'flc', name: 'FLC Sea Tower Quy Nhơn', prefix: 'FLC' },
  { slug: 'tms', name: 'TMS Luxury Hotel & Residences Quy Nhơn', prefix: 'TMS' },
  { slug: 'hagl', name: 'HAGL Quy Nhơn', aliases: ['Hoàng Anh Gia Lai'], prefix: 'HAG' },
  { slug: 'apt', name: 'An Phú Thịnh Garden Tower', prefix: 'APT' },
  { slug: 'thinhphat', name: 'Thịnh Phát Tower', prefix: 'TPT' },
  { slug: 'ecolife', name: 'Ecolife Riverside', prefix: 'ECO' },
];
const TODAY = '2026-10-09';
const p = (m: string) => parseMessage(m, B, TODAY);
/** value-only view: { field: value } (+ '?' suffix when unsure) */
const v = (r: ParsedMessage) => Object.fromEntries(Object.entries(r).map(([k, x]) => [k, x!.value + (x!.sure ? '' : '?')]));

describe('paste owner message → fields (real-style messages)', () => {
  const cases: [string, Record<string, string>][] = [
    ['Cho thuê căn Altara tầng 18, 2PN 2WC, 68m2, full nội thất, giá 13tr5, cọc 2 tháng, đóng 3 tháng/lần. LH 0905 123 456',
      { building: 'altara', floor: '18', beds: '2', baths: '2', area: '68', furn: 'full', rent: '13500000', deposit: '2', cycle: 'm3', owner_phone: '0905123456' }],
    ['FLC t25 1pn 45m2 nt đầy đủ 9tr/tháng, trống từ 15/10',
      { building: 'flc', floor: '25', beds: '1', area: '45', furn: 'full', rent: '9000000?', move_in: '2026-10-15?' }],
    ['Căn hộ Phu Tai Residence lau 12, 2 phong ngu, 1 ve sinh, dt 70, gia 10.5tr, vao o ngay',
      { building: 'phutai', floor: '12', beds: '2', baths: '1', area: '70', rent: '10500000', move_in: TODAY }],
    ['TMS căn 23.08 view biển, studio 38m², giá thuê 12.000.000đ/tháng, nội thất cơ bản',
      { building: 'tms', unit_no: '23.08?', floor: '23?', view: 'sea', beds: '0', area: '38', rent: '12000000', furn: 'basic' }],
    ['Ecolife 3PN 2WC 95 m2, không nội thất, giá 11 triệu, đóng theo tháng, sđt +84 935 111 222',
      { building: 'ecolife', beds: '3', baths: '2', area: '95', furn: 'empty', rent: '11000000', cycle: 'm1', owner_phone: '0935111222' }],
    ['Thinh Phat tang 9 2pn2wc 72m2 gia 8tr5 coc 1 thang thanh toan 1 thang 1 lan',
      { building: 'thinhphat', floor: '9', beds: '2', baths: '2', area: '72', rent: '8500000', deposit: '1', cycle: 'm1' }],
    ['HAGL căn góc tầng 15 hướng Đông Nam, 2 phòng ngủ, 13500k, không nuôi thú cưng',
      { building: 'hagl', floor: '15', dir: 'SE', beds: '2', rent: '13500000?', pets: 'false' }],
    ['Cần cho thuê An Phú Thịnh 1PN 50m2 full đồ 7tr500 trống từ 1/11/2026 LH: 0912.345.678',
      { building: 'apt', beds: '1', area: '50', furn: 'full', rent: '7500000?', move_in: '2026-11-01', owner_phone: '0912345678' }],
    ['Altara 2pn view biển, 13,5 triệu/tháng, phí quản lý 822k, gửi xe 60k',
      { building: 'altara', beds: '2', view: 'sea', rent: '13500000?' }],
    ['alta t20 2pn 70m2 15tr cho nuôi pet',
      { building: 'altara', floor: '20', beds: '2', area: '70', rent: '15000000?', pets: 'true' }],
    ['Phòng 1805 Altara, 2 ngủ, nội thất đầy đủ, giá 14 củ',
      { building: 'altara', unit_no: '18.05?', floor: '18?', beds: '2', furn: 'full', rent: '14000000' }],
    ['FLC Sea Tower tầng 30\n1PN 1WC 40m2\nGiá: 8.000.000\nĐặt cọc 2 tháng\nTrống ngay',
      { building: 'flc', floor: '30', beds: '1', baths: '1', area: '40', rent: '8000000', deposit: '2', move_in: TODAY }],
    ['Cho thue can ho Hoang Anh Gia Lai 2pn 2wc 80m2 view song gia 9tr dong 3 thang 1 lan',
      { building: 'hagl', beds: '2', baths: '2', area: '80', view: 'river', rent: '9000000', cycle: 'm3' }],
    ['Ecolife Riverside studio 32m2, 5tr5, có máy giặt, vào ở được ngay, đt 0987654321',
      { building: 'ecolife', beds: '0', area: '32', rent: '5500000?', move_in: TODAY, owner_phone: '0987654321' }],
    ['TMS 3 phòng ngủ 110m2 view biển full nội thất giá 25tr cọc 2 tháng tt 3 tháng/lần',
      { building: 'tms', beds: '3', area: '110', view: 'sea', furn: 'full', rent: '25000000', deposit: '2', cycle: 'm3' }],
    ['An Phu Thinh t7, 2PN, 65 m², gia thue 7.5 trieu, trong tu 20/10',
      { building: 'apt', floor: '7', beds: '2', area: '65', rent: '7500000', move_in: '2026-10-20?' }],
    ['Thịnh Phát căn 10-05, 1pn, 48m2, 6tr, hướng tây',
      { building: 'thinhphat', unit_no: '10.05?', floor: '10?', beds: '1', area: '48', rent: '6000000?', dir: 'W' }],
    ['Altara 1 phòng ngủ tầng 22 giá thuê 11tr bao phí quản lý',
      { building: 'altara', beds: '1', floor: '22', rent: '11000000' }],
    ['FLC 2PN view biển 63m2 giá 12tr, phí ql 16.5k/m2, cọc 1 tháng, khách nuôi mèo ok',
      { building: 'flc', beds: '2', view: 'sea', area: '63', rent: '12000000', deposit: '1', pets: 'true' }],
    ['Cho thuê căn 2pn tầng 5, 60m2, 6 triệu',
      { floor: '5', beds: '2', area: '60', rent: '6000000?' }],
    ['Phu Tai 2PN 2WC nội thất cơ bản 9tr, sđt chủ: 0901 234 567, dọn vào 5/1',
      { building: 'phutai', beds: '2', baths: '2', furn: 'basic', rent: '9000000?', owner_phone: '0901234567', move_in: '2027-01-05?' }],
    ['HAGL 70m2 2pn giá 8tr5/tháng tiền điện nước theo EVN, ko nuôi chó mèo',
      { building: 'hagl', area: '70', beds: '2', rent: '8500000', pets: 'false' }],
    ['TMS studio view biển 35m2 giá 9.500.000 đ, trống 01/12/26',
      { building: 'tms', beds: '0', view: 'sea', area: '35', rent: '9500000', move_in: '2026-12-01' }],
    ['ecolife lầu 3, 2 ngủ 1 tắm, 68m2, 7 triệu rưỡi',
      { building: 'ecolife', floor: '3', beds: '2', baths: '1', area: '68', rent: '7500000?' }],
    ['Altara Residences T16 2PN2WC 69,5m2 full NT giá 14tr. Đóng 3th/lần. Cọc 2th. LH chị Lan 0773 456 789',
      { building: 'altara', floor: '16', beds: '2', baths: '2', area: '69.5', furn: 'full', rent: '14000000', cycle: 'm3', deposit: '2', owner_phone: '0773456789' }],
    ['Gửi em căn FLC tầng 12 nhé, 1pn, giá 8tr, chủ nhà sđt 0838 000 111 (gọi sau 6h)',
      { building: 'flc', floor: '12', beds: '1', rent: '8000000', owner_phone: '0838000111' }],
  ];
  it.each(cases)('%s', (msg, want) => expect(v(p(msg))).toEqual(want));
});

describe('safety', () => {
  it('never invents: an unrelated message gives nothing', () => expect(p('Anh ơi tối nay em gọi lại nhé')).toEqual({}));
  it('landline / short numbers are not owner phones; fees are not rent', () => {
    const r = v(p('Phí quản lý 800k, gửi xe 60k, hotline 1900 1234'));
    expect(r.owner_phone).toBeUndefined();
    expect(r.rent).toBeUndefined();
  });
  it('an implausible amount is ignored', () => expect(v(p('giá 500k')).rent).toBeUndefined());
});
