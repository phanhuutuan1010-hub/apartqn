/**
 * Listings — ported 1:1 from _handoff/design/apartqn-data.js (`L`, merged with `base`).
 * ALL values are demo data (`demo: true`). Unit photos are not supplied yet: `photos` is empty
 * and `photoCount` keeps the prototype's count so the striped placeholders render.
 */

export type Furnishing = 'full' | 'basic' | 'empty';
export type ListingStatus = 'available' | 'reserved' | 'rented';
export type Direction = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';
export type ViewKind = 'sea' | 'city' | 'river' | 'lagoon';

export type Listing = {
  code: string;
  buildingId: string;
  floor: number;
  area: number;
  beds: number;
  baths: number;
  dir: Direction;
  view: ViewKind;
  furn: Furnishing;
  rent: number;
  /** months */
  deposit: number;
  cycle: 'm1' | 'm3';
  mgmt: number;
  elec: 'evn' | 'fixed';
  water: 'meter' | 'person';
  moto: number;
  car: number;
  net: number;
  minTerm: number;
  maxOcc: number;
  pets: boolean;
  tempReg: boolean;
  verified: boolean;
  video: boolean;
  status: ListingStatus;
  /** YYYY-MM-DD */
  moveIn: string;
  /** YYYY-MM-DD */
  updated: string;
  photos: string[];
  photoCount: number;
  /** No data yet — admin will add it (Phase 2) */
  carParking?: boolean;
  demo: boolean;
};

type Raw = Omit<Listing, 'deposit' | 'cycle' | 'elec' | 'water' | 'minTerm' | 'tempReg' | 'verified' | 'video' | 'status' | 'photos' | 'demo'> &
  Partial<Pick<Listing, 'deposit' | 'cycle' | 'elec' | 'water' | 'minTerm' | 'tempReg' | 'verified' | 'video' | 'status'>>;

const base = { deposit: 2, cycle: 'm1', elec: 'evn', water: 'meter', minTerm: 6, tempReg: true, verified: true, video: false, status: 'available' } as const;

const RAW: Raw[] = [
  { code: 'QN-001', buildingId: 'altara', floor: 18, area: 68, beds: 2, baths: 2, dir: 'SE', view: 'sea', furn: 'full', rent: 13500000, mgmt: 816000, moto: 150000, car: 1500000, net: 220000, maxOcc: 4, pets: false, moveIn: '2026-10-05', updated: '2026-09-21', photoCount: 12, video: true },
  { code: 'QN-002', buildingId: 'flc', floor: 25, area: 45, beds: 1, baths: 1, dir: 'E', view: 'sea', furn: 'full', rent: 9000000, deposit: 1, cycle: 'm3', mgmt: 540000, elec: 'fixed', water: 'person', moto: 120000, car: 1200000, net: 0, maxOcc: 2, pets: true, moveIn: '2026-09-28', updated: '2026-09-22', photoCount: 9 },
  { code: 'QN-003', buildingId: 'tms', floor: 30, area: 85, beds: 2, baths: 2, dir: 'S', view: 'sea', furn: 'full', rent: 18000000, mgmt: 1190000, moto: 150000, car: 1800000, net: 250000, minTerm: 12, maxOcc: 4, pets: false, moveIn: '2026-11-01', updated: '2026-09-19', photoCount: 14, video: true, status: 'reserved' },
  { code: 'QN-004', buildingId: 'phutai', floor: 9, area: 72, beds: 2, baths: 2, dir: 'NE', view: 'city', furn: 'basic', rent: 8500000, deposit: 1, mgmt: 504000, moto: 100000, car: 1000000, net: 200000, maxOcc: 4, pets: true, moveIn: '2026-10-01', updated: '2026-09-15', photoCount: 7, tempReg: false, verified: false },
  { code: 'QN-005', buildingId: 'hagl', floor: 14, area: 98, beds: 3, baths: 2, dir: 'W', view: 'lagoon', furn: 'basic', rent: 11000000, cycle: 'm3', mgmt: 686000, moto: 100000, car: 1000000, net: 200000, maxOcc: 6, pets: true, moveIn: '2026-10-10', updated: '2026-09-20', photoCount: 10, video: true },
  { code: 'QN-006', buildingId: 'ecolife', floor: 8, area: 64, beds: 2, baths: 2, dir: 'E', view: 'river', furn: 'full', rent: 8000000, mgmt: 448000, moto: 100000, car: 900000, net: 200000, maxOcc: 4, pets: false, moveIn: '2026-10-15', updated: '2026-09-18', photoCount: 8 },
  { code: 'QN-007', buildingId: 'apt', floor: 11, area: 60, beds: 2, baths: 1, dir: 'N', view: 'city', furn: 'empty', rent: 6500000, deposit: 1, mgmt: 360000, moto: 80000, car: 800000, net: 180000, maxOcc: 4, pets: true, moveIn: '2026-10-01', updated: '2026-09-12', photoCount: 6, verified: false },
  { code: 'QN-008', buildingId: 'thinhphat', floor: 16, area: 55, beds: 1, baths: 1, dir: 'SE', view: 'sea', furn: 'full', rent: 10000000, mgmt: 440000, moto: 120000, car: 1200000, net: 220000, maxOcc: 2, pets: false, moveIn: '2027-03-01', updated: '2026-09-10', photoCount: 9, status: 'rented' },
  { code: 'QN-009', buildingId: 'altara', floor: 22, area: 52, beds: 1, baths: 1, dir: 'E', view: 'sea', furn: 'full', rent: 11000000, mgmt: 624000, moto: 150000, car: 1500000, net: 220000, maxOcc: 2, pets: false, moveIn: '2026-10-20', updated: '2026-09-23', photoCount: 11, video: true },
];

export const LISTINGS: Listing[] = RAW.map((l) => ({ ...base, ...l, photos: [], demo: true }));
