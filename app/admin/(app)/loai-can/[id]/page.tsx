import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import { requireStaff, staffDirectory } from '@/lib/admin/session';
import { supabaseServer, SUPABASE_URL } from '@/lib/supabase/server';
import { publicPhotoUrl } from '@/lib/repoMap';
import { daysAgoIso, fmtDateTime, UT_LABEL } from '@/lib/admin/labels';
import { LOCALES, type Locale } from '@/i18n/locales';
import { describeUnitType } from '@/lib/content/describe';
import { toBuildingFees } from '@/lib/fees';
import type { BuildingAmenity } from '@/lib/types';
import type { Feature, Furniture, UnitTypeKind, View } from '@/lib/unitTypes';
import type { PhotoView } from '@/components/admin/PhotoManager';
import { PhotoManagerLazy } from '@/components/admin/PhotoManagerLazy';
import { UnitTypeForm, type UnitTypeData } from '@/components/admin/UnitTypeForm';
import { UnitTypeMenu, UnitTypeVisibility } from '@/components/admin/UnitTypeControls';
import { PostButton } from '@/components/admin/PostButton';

export const metadata: Metadata = { title: 'Loại căn' };

export default async function UnitTypeEditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string; copied?: string }> }) {
  const { id } = await params;
  const { created, copied } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const me = await requireStaff();
  const sb = await supabaseServer();
  const [{ data: u }, { data: ph }, dir] = await Promise.all([
    sb.from('unit_types').select('*, buildings(*)').eq('id', id).maybeSingle(),
    sb.from('photos').select('id, path, thumb_path, visibility, is_cover, width, height, watermark, tag, source, needs_reupload').eq('unit_type_id', id).order('sort'),
    staffDirectory(),
  ]);
  if (!u) notFound(); // not found, or in the trash (RLS)
  const b = u.buildings as { id: string; name: string; street: string; amenities: string[]; code_prefix: string; is_visible: boolean } & Record<string, unknown>;
  const [{ data: others }, { count: leadN }, { count: chatN }] = await Promise.all([
    sb.from('admin_unit_types').select('id, code, building_name').neq('id', id).order('building_sort').order('sort'),
    sb.from('leads').select('id', { count: 'exact', head: true }).eq('unit_type_id', id).gte('created_at', daysAgoIso(30)),
    sb.from('contact_intents').select('id', { count: 'exact', head: true }).eq('code', u.code).gte('created_at', daysAgoIso(30)),
  ]);
  const photos: PhotoView[] = (ph ?? []).map((p) => ({
    id: p.id, visibility: p.visibility, is_cover: p.is_cover, width: p.width, height: p.height, watermark: p.watermark, tag: p.tag, source: p.source,
    needs_reupload: p.needs_reupload, url: publicPhotoUrl(SUPABASE_URL, p.thumb_path ?? p.path),
  }));
  const live = u.is_visible && b.is_visible;
  const editor = u.updated_by ? dir.get(u.updated_by)?.name : null;
  const can = me.role === 'admin' || me.can_publish;
  // generated description preview (as saved); needs a price and an area to say anything useful
  const unit = { type: u.type as UnitTypeKind, areaMin: Number(u.area_min ?? 0), areaMax: Number(u.area_max ?? u.area_min ?? 0), priceFrom: Number(u.price_from ?? 0),
    furniture: (u.furniture ?? undefined) as Furniture | undefined, views: (u.views ?? []) as View[], features: (u.features ?? []) as Feature[] };
  const bld = { name: b.name, street: b.street, amenities: (b.amenities ?? []) as BuildingAmenity[], fees: toBuildingFees(b) };
  const generated = Object.fromEntries(LOCALES.map((l) => [l, u.price_from != null && u.area_min != null ? describeUnitType(unit, bld, l) : 'Điền giá “từ” và diện tích để xem mô tả tự sinh.'])) as Record<Locale, string>;

  return (
    <div className="a-page">
      <div className="a-head">
        <div>
          <Link href={`/admin/loai-can?b=${b.id}`} className="a-small" style={{ color: 'var(--blue-500)' }}>← Loại căn · {b.name}</Link>
          <h1 className="a-h1" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {UT_LABEL[u.type]} · {b.name} <span className="a-mono a-small a-muted">{u.code}</span>
          </h1>
          <div className="a-sub">
            Sửa lần cuối {editor ? <>bởi <b>{editor}</b> </> : ''}lúc {fmtDateTime(u.updated_at)}
            {u.price_updated_at && <> · Giá cập nhật {fmtDateTime(u.price_updated_at)}</>}
          </div>
          <div className="a-sub">30 ngày: <b>{leadN ?? 0}</b> yêu cầu “Kiểm tra căn trống” · <b>{chatN ?? 0}</b> lần bấm Zalo / WhatsApp</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <UnitTypeVisibility id={id} visible={u.is_visible} ready={u.price_from != null && u.area_min != null} can={can} label />
          {live && <a className="a-btn a-btn-ghost a-btn-sm" href={`/${u.code}`} target="_blank" rel="noopener"><ExternalLink size={14} aria-hidden /> Xem trên website</a>}
          <PostButton id={id} disabled={!live} />
          <UnitTypeMenu id={id} code={u.code} isAdmin={me.role === 'admin'} targets={(others ?? []).map((o) => ({ id: o.id, label: `${o.code} · ${o.building_name}` }))} />
        </div>
      </div>
      {!b.is_visible && <div className="a-alert warn" style={{ marginBottom: 14 }}>Toà nhà đang ẩn — loại căn này chỉ lên website khi toà được bật hiển thị.</div>}
      {created && <div className="a-alert ok" style={{ marginBottom: 14 }}>Đã tạo loại căn (đang ẩn). Điền giá, diện tích, thêm ảnh căn mẫu rồi bật Hiển thị.</div>}
      {copied && <div className="a-alert ok" style={{ marginBottom: 14 }}>Đã nhân bản giá, diện tích, nội thất, view, đặc điểm và mô tả tự viết sang loại căn này. Kiểm tra lại rồi lưu nếu cần chỉnh.</div>}
      <UnitTypeForm
        u={u as UnitTypeData}
        generated={generated}
        photos={<PhotoManagerLazy owner={{ kind: 'unit_type', id }} photos={photos} />}
      />
    </div>
  );
}
