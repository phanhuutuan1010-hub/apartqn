/** Public data shapes used by the site. Produced by lib/repo.ts from the Supabase public views (buildings, unit types). */

import type { Locale } from '@/i18n/locales';
import type { Feature, UnitTypeKind } from './unitTypes';

export type BuildingAmenity = 'pool' | 'gym' | 'security' | 'lift' | 'basement' | 'mart' | 'kids';
export type Furnishing = 'full' | 'basic' | 'empty';
export type ViewKind = 'sea' | 'city' | 'river' | 'lagoon';
/** desc_{locale} of every site language (i18n/locales.ts) */
export type Descriptions = Partial<Record<Locale, string>>;
export type { BuildingFees } from './fees';
import type { BuildingFees } from './fees';

export const PHOTO_TAGS = ['toan-canh', 'tien-ich', 'sanh', 'view', 'can-ho', 'khac'] as const;
export type PhotoTag = (typeof PHOTO_TAGS)[number];
/** src: own shot / reference image; missing = not stated (no badge) */
export type PhotoMeta = { tag: PhotoTag; src?: 'own' | 'reference'; w?: number; h?: number };
/** width / height of a photo, when known */
export const ratioOf = (m?: PhotoMeta) => (m?.w && m.h ? m.w / m.h : undefined);

export type Building = {
  /** URL slug (e.g. "altara") */
  id: string;
  name: string;
  street: string;
  /** ward (search only; no longer shown or edited) */
  ward?: string;
  wardOld?: string;
  lat?: number;
  lng?: number;
  /** Google Maps link pasted by the admin */
  mapsUrl?: string;
  amenities: BuildingAmenity[];
  /** full-size public photo URLs, cover first; empty → striped placeholder */
  photos: string[];
  /** smallest variant (640 px), same order as photos */
  thumbs: string[];
  /** srcset of each photo's own variants (640 / 1200 / 1920 w), same order */
  srcsets: string[];
  /** tag / source / size per photo, same order (missing → 'khac', own) */
  photoMeta?: PhotoMeta[];
  /** unlisted YouTube link */
  videoUrl?: string;
  desc: Descriptions;
  demo: boolean;
  /** other names people search for (any script) */
  aliases: string[];
  /** code prefix = the building URL (apartqn.com/ALT) and the unit type codes (ALT-2PN) */
  prefix: string;
  /** management-office rates (public subset: no source note) */
  fees: Omit<BuildingFees, 'fee_source'>;
};

export type UnitType = {
  /** ALT-2PN */
  code: string;
  /** building slug */
  buildingId: string;
  /** building code prefix (ALT) */
  prefix: string;
  type: UnitTypeKind;
  areaMin: number;
  /** = areaMin when only one size is known */
  areaMax: number;
  /** "from" monthly rent, VND (reference price) */
  priceFrom: number;
  /** YYYY-MM-DD of the last price change ("cập nhật 10/2026") */
  priceUpdated: string;
  furnitureNote?: string;
  viewNote?: string;
  features: Feature[];
  desc: Descriptions;
  /** sample-unit photos: full-size URLs, cover first; empty → striped placeholder */
  photos: string[];
  thumbs: string[];
  srcsets: string[];
  photoMeta?: PhotoMeta[];
  sort: number;
  demo: boolean;
  /** YYYY-MM-DD */
  updated: string;
};
