/**
 * Pure mappers: public_buildings / public_unit_types rows → site types. Kept separate from lib/repo.ts so they can be tested
 * against rows from plain Postgres (bigint/numeric arrive as strings there, numbers via PostgREST).
 */
import { PHOTO_TAGS, type Building, type BuildingAmenity, type Descriptions, type PhotoMeta, type PhotoTag, type UnitType } from './types';
import { toBuildingFees } from './fees';
import { LOCALES } from '@/i18n/locales';
import { AMENITIES, FEATURES, FURNITURE, VIEWS, isUnitTypeKind, type Amenity, type Feature, type Furniture, type View } from './unitTypes';

type PhotoRow = { path: string; thumb: string | null; w?: number | null; h?: number | null; tag?: string | null; source?: string | null; v?: { w: number; path: string }[] | null };
/** "url 640w, url 1200w, …" from the photo's own variants (older photos: the 600 px thumb + the full file) */
const srcset = (p: PhotoRow, base: string): string => {
  const vs = p.v?.length ? p.v : [...(p.thumb && p.thumb !== p.path ? [{ w: Math.min(600, Number(p.w) || 600), path: p.thumb }] : []), { w: Number(p.w) || 1600, path: p.path }];
  return vs.map((v) => `${publicPhotoUrl(base, v.path)} ${v.w}w`).join(', ');
};
const meta = (p: PhotoRow): PhotoMeta => ({
  tag: (PHOTO_TAGS as readonly string[]).includes(p.tag ?? '') ? (p.tag as PhotoTag) : 'khac',
  ...(p.source === 'own' || p.source === 'reference' ? { src: p.source } : {}),
  ...(p.w && p.h ? { w: Number(p.w), h: Number(p.h) } : {}),
});

export type PublicBuildingRow = {
  slug: string; name: string; street: string; ward_new: string | null; ward_old: string | null;
  lat: number | string | null; lng: number | string | null; amenities: string[];
  /** desc_{locale} */ desc_vi: string | null; desc_en: string | null; is_demo: boolean; photos: PhotoRow[] | null;
  /** missing before migration 9 */
  aliases?: string[] | null;
  /** missing before migration 13 */
  code_prefix?: string | null;
  /** missing before migration 16 */
  maps_url?: string | null;
  /** missing before migration 17 */
  video_url?: string | null;
  /** fee columns: migration 14 */
  [fee: string]: unknown;
};

export type PublicUnitTypeRow = {
  code: string; building_slug: string; code_prefix: string; type: string;
  area_min: number | string; area_max: number | string | null; price_from: number | string;
  price_updated_at: string | Date | null; furniture_note: string | null; view_note: string | null; features: string[] | null;
  sort: number | string; updated_at: string | Date; is_demo: boolean; photos: PhotoRow[] | null;
  /** desc_{locale} */
  [desc: string]: unknown;
};

/** Public URL of an object in the listing-public bucket */
export const publicPhotoUrl = (supabaseUrl: string, path: string) =>
  `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/listing-public/${path.split('/').map(encodeURIComponent).join('/')}`;

const n = (v: number | string | null | undefined) => (v == null ? 0 : Number(v));
const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
/** desc_custom_{locale} (staff override) for every site language; none → the page generates the text */
const desc = (r: Record<string, unknown>): Descriptions =>
  Object.fromEntries(LOCALES.flatMap((l) => (text(r[`desc_custom_${l}`]) ? [[l, text(r[`desc_custom_${l}`])]] : [])));
/** the known values of a list, in their canonical order (lib/unitTypes.ts) */
const only = <T extends string>(xs: unknown, ok: readonly T[]): T[] => (Array.isArray(xs) ? ok.filter((k) => xs.includes(k)) : []);

/** YYYY-MM-DD in Vietnam time */
export const vnDate = (v: string | Date) => {
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  return new Date(v).toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
};

export function toBuilding(r: PublicBuildingRow, supabaseUrl: string): Building {
  const photos = r.photos ?? [];
  return {
    id: r.slug,
    name: r.name,
    street: r.street,
    ward: text(r.ward_new),
    wardOld: text(r.ward_old),
    ...(r.lat != null && r.lng != null ? { lat: n(r.lat), lng: n(r.lng) } : {}),
    ...(text(r.maps_url ?? null) ? { mapsUrl: text(r.maps_url ?? null) } : {}),
    amenities: only<Amenity>(r.amenities, AMENITIES) as BuildingAmenity[],
    photos: photos.map((p) => publicPhotoUrl(supabaseUrl, p.path)),
    thumbs: photos.map((p) => publicPhotoUrl(supabaseUrl, p.thumb ?? p.path)),
    srcsets: photos.map((p) => srcset(p, supabaseUrl)),
    photoMeta: photos.map(meta),
    ...(text(r.video_url ?? null) ? { videoUrl: text(r.video_url ?? null) } : {}),
    desc: desc(r as Record<string, unknown>),
    demo: r.is_demo,
    aliases: r.aliases ?? [],
    prefix: r.code_prefix ?? '',
    fees: (({ fee_source, ...f }) => (void fee_source, f))(toBuildingFees(r)),
  };
}

export function toUnitType(r: PublicUnitTypeRow, supabaseUrl: string): UnitType | null {
  if (!isUnitTypeKind(r.type)) return null;
  const photos = r.photos ?? [];
  const areaMin = n(r.area_min);
  return {
    code: r.code,
    buildingId: r.building_slug,
    prefix: r.code_prefix,
    type: r.type,
    areaMin,
    areaMax: r.area_max == null ? areaMin : Math.max(areaMin, n(r.area_max)),
    priceFrom: n(r.price_from),
    priceUpdated: vnDate(r.price_updated_at ?? r.updated_at),
    ...((FURNITURE as readonly unknown[]).includes(r.furniture) ? { furniture: r.furniture as Furniture } : {}),
    views: only<View>(r.views, VIEWS),
    features: only<Feature>(r.features, FEATURES),
    desc: desc(r),
    photos: photos.map((p) => publicPhotoUrl(supabaseUrl, p.path)),
    thumbs: photos.map((p) => publicPhotoUrl(supabaseUrl, p.thumb ?? p.path)),
    srcsets: photos.map((p) => srcset(p, supabaseUrl)),
    photoMeta: photos.map(meta),
    sort: n(r.sort),
    demo: r.is_demo,
    updated: vnDate(r.updated_at),
  };
}
