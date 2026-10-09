/** Public data shapes used by the site. Produced by lib/repo.ts from the Supabase public views. */

export type BuildingAmenity = 'pool' | 'gym' | 'security' | 'lift' | 'basement' | 'mart' | 'kids';
export type Furnishing = 'full' | 'basic' | 'empty';
export type ListingStatus = 'available' | 'reserved' | 'rented';
export type Direction = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';
export type ViewKind = 'sea' | 'city' | 'river' | 'lagoon';
export type Descriptions = { vi?: string; en?: string };
export type { BuildingFees } from './fees';
import type { BuildingFees } from './fees';

export type Building = {
  /** URL slug (e.g. "altara") */
  id: string;
  name: string;
  street: string;
  /** current ward (after the 2025 merger); missing → "Phường —" */
  ward?: string;
  wardOld?: string;
  lat?: number;
  lng?: number;
  amenities: BuildingAmenity[];
  /** full-size public photo URLs, cover first; empty → striped placeholder */
  photos: string[];
  /** 600px thumbnails, same order as photos */
  thumbs: string[];
  desc: Descriptions;
  demo: boolean;
  /** other names people search for (any script) */
  aliases: string[];
  /** listing code prefix (ALT → ALT-001) */
  prefix: string;
  /** management-office rates (public subset: no source note) */
  fees: Omit<BuildingFees, 'fee_source'>;
};

export type Listing = {
  code: string;
  /** building slug */
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
  thumbs: string[];
  /** photos.length, or the demo placeholder count when there are no photos yet */
  photoCount: number;
  carParking?: boolean;
  /** unlisted YouTube link (videos are never uploaded) */
  videoUrl?: string;
  /** old QN-### code (redirects, search) */
  legacyCode?: string;
  /** who pays the management fee (default tenant) */
  mgmtPaidBy?: 'tenant' | 'owner';
  desc: Descriptions;
  demo: boolean;
  /** ISO timestamps (search ranking) */
  verifiedAt?: string;
  publishedAt?: string;
};
