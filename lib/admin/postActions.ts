'use server';

import { z } from 'zod';
import { requireStaff } from '@/lib/admin/session';
import { supabaseServer, SUPABASE_URL } from '@/lib/supabase/server';
import { publicPhotoUrl } from '@/lib/repoMap';
import { CANONICAL_URL } from '@/data/site';
import { FEATURES, FURNITURE, VIEWS, isUnitTypeKind, type Feature, type Furniture, type UnitTypeKind, type View } from '@/lib/unitTypes';
import type { TypePost } from '@/lib/unitTypePost';

type Row = { id: string; code: string; type: string; building_name: string; price_from: number | null; area_min: number | null; area_max: number | null; furniture: string | null; views: string[]; features: string[]; is_visible: boolean; building_visible: boolean };
const COLS = 'id, code, type, building_name, price_from, area_min, area_max, furniture, views, features, is_visible, building_visible';

const toPost = (r: Row, photoCount: number): TypePost => ({
  code: r.code, type: r.type as UnitTypeKind, building: r.building_name, priceFrom: Number(r.price_from ?? 0),
  areaMin: r.area_min == null ? null : Number(r.area_min), areaMax: r.area_max == null ? null : Number(r.area_max),
  furniture: (FURNITURE as readonly string[]).includes(r.furniture ?? '') ? (r.furniture as Furniture) : null,
  views: (r.views ?? []).filter((v): v is View => (VIEWS as readonly string[]).includes(v)),
  features: (r.features ?? []).filter((f): f is Feature => (FEATURES as readonly string[]).includes(f)), photoCount,
});

/**
 * Inputs for "Tạo bài đăng": the unit type's public fields + up to 6 public sample photos (rendered files, watermarked
 * as set) + the same type in every visible building (the roundup). Only what the site shows; no phone number.
 */
export async function getPostData(id: string): Promise<{ data?: TypePost; live?: boolean; roundup?: TypePost[]; images?: string[]; origin?: string; error?: string }> {
  await requireStaff();
  if (!z.string().uuid().safeParse(id).success) return { error: 'Loại căn không hợp lệ.' };
  const sb = await supabaseServer();
  const [{ data: r }, { data: photos }] = await Promise.all([
    sb.from('admin_unit_types').select(COLS).eq('id', id).maybeSingle(),
    sb.from('photos').select('path').eq('unit_type_id', id).eq('visibility', 'public').is('deleted_at', null).order('is_cover', { ascending: false }).order('sort').limit(6),
  ]);
  if (!r || !isUnitTypeKind((r as Row).type)) return { error: 'Không thấy loại căn.' };
  const row = r as Row;
  const { data: same } = await sb.from('admin_unit_types').select(COLS).eq('type', row.type).eq('is_visible', true).eq('building_visible', true).order('price_from');
  return {
    data: toPost(row, (photos ?? []).length),
    live: row.is_visible && row.building_visible && row.price_from != null,
    roundup: ((same ?? []) as Row[]).filter((x) => x.price_from != null).map((x) => toPost(x, 1)),
    images: (photos ?? []).map((p) => publicPhotoUrl(SUPABASE_URL, p.path)),
    origin: CANONICAL_URL,
  };
}
