/**
 * Pure mappers: public_* view rows → site types. Kept separate from lib/repo.ts so they can be tested
 * against rows from plain Postgres (bigint/numeric arrive as strings there, numbers via PostgREST).
 */
import type { Building, BuildingAmenity, Descriptions, Listing } from './types';

type PhotoRow = { path: string; thumb: string | null };

export type PublicBuildingRow = {
  slug: string; name: string; street: string; ward_new: string | null; ward_old: string | null;
  lat: number | string | null; lng: number | string | null; amenities: string[];
  desc_vi: string | null; desc_en: string | null; desc_ru: string | null; is_demo: boolean; photos: PhotoRow[] | null;
};

export type PublicListingRow = {
  code: string; building_slug: string; floor: number | string; area: number | string; beds: number | string;
  baths: number | string; dir: string; view: string; furn: string; rent: number | string; deposit: number | string;
  cycle: string; mgmt: number | string; elec: string; water: string; moto: number | string; car: number | string;
  net: number | string; min_term: number | string; max_occ: number | string; pets: boolean; temp_reg: boolean;
  car_parking: boolean | null; verified: boolean; video: boolean; status: string; move_in: string | Date;
  updated_at: string | Date; placeholder_photos: number | string; is_demo: boolean;
  desc_vi: string | null; desc_en: string | null; desc_ru: string | null; photos: PhotoRow[] | null;
};

/** Public URL of an object in the listing-public bucket */
export const publicPhotoUrl = (supabaseUrl: string, path: string) =>
  `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/listing-public/${path.split('/').map(encodeURIComponent).join('/')}`;

const n = (v: number | string | null | undefined) => (v == null ? 0 : Number(v));
const text = (v: string | null) => (v && v.trim() ? v.trim() : undefined);
const desc = (r: { desc_vi: string | null; desc_en: string | null; desc_ru: string | null }): Descriptions => ({
  vi: text(r.desc_vi), en: text(r.desc_en), ru: text(r.desc_ru),
});

/** YYYY-MM-DD in Vietnam time */
export const vnDate = (v: string | Date) => {
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  return new Date(v).toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
};
/** A DATE column: pg gives a local-midnight Date, PostgREST gives "YYYY-MM-DD" */
const dateOnly = (v: string | Date) =>
  typeof v === 'string' ? v.slice(0, 10) : `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;

export function toBuilding(r: PublicBuildingRow, supabaseUrl: string): Building {
  const photos = r.photos ?? [];
  return {
    id: r.slug,
    name: r.name,
    street: r.street,
    ward: text(r.ward_new),
    wardOld: text(r.ward_old),
    ...(r.lat != null && r.lng != null ? { lat: n(r.lat), lng: n(r.lng) } : {}),
    amenities: r.amenities as BuildingAmenity[],
    photos: photos.map((p) => publicPhotoUrl(supabaseUrl, p.path)),
    thumbs: photos.map((p) => publicPhotoUrl(supabaseUrl, p.thumb ?? p.path)),
    desc: desc(r),
    demo: r.is_demo,
  };
}

export function toListing(r: PublicListingRow, supabaseUrl: string): Listing {
  const photos = r.photos ?? [];
  return {
    code: r.code,
    buildingId: r.building_slug,
    floor: n(r.floor),
    area: n(r.area),
    beds: n(r.beds),
    baths: n(r.baths),
    dir: r.dir as Listing['dir'],
    view: r.view as Listing['view'],
    furn: r.furn as Listing['furn'],
    rent: n(r.rent),
    deposit: n(r.deposit),
    cycle: r.cycle as Listing['cycle'],
    mgmt: n(r.mgmt),
    elec: r.elec as Listing['elec'],
    water: r.water as Listing['water'],
    moto: n(r.moto),
    car: n(r.car),
    net: n(r.net),
    minTerm: n(r.min_term),
    maxOcc: n(r.max_occ),
    pets: r.pets,
    tempReg: r.temp_reg,
    verified: r.verified,
    video: r.video,
    status: r.status as Listing['status'],
    moveIn: dateOnly(r.move_in),
    updated: vnDate(r.updated_at),
    photos: photos.map((p) => publicPhotoUrl(supabaseUrl, p.path)),
    thumbs: photos.map((p) => publicPhotoUrl(supabaseUrl, p.thumb ?? p.path)),
    photoCount: photos.length || n(r.placeholder_photos),
    ...(r.car_parking != null ? { carParking: r.car_parking } : {}),
    desc: desc(r),
    demo: r.is_demo,
  };
}
