import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Copy, ExternalLink, MoreHorizontal } from 'lucide-react';
import { EMPTY_FEES, FEE_FIELDS, toBuildingFees } from '@/lib/fees';
import { requireAdmin, staffDirectory } from '@/lib/admin/session';
import { supabaseServer, SUPABASE_URL } from '@/lib/supabase/server';
import { publicPhotoUrl } from '@/lib/repoMap';
import { fmtDateTime } from '@/lib/admin/labels';
import { BuildingForm, type BuildingData } from '@/components/admin/BuildingForm';
import { BuildingDelete } from '@/components/admin/BuildingDelete';
import { BuildingVisibility } from '@/components/admin/BuildingVisibility';
import { LOCALES, type Locale } from '@/i18n/locales';
import { describeBuilding } from '@/lib/content/describe';
import { isUnitTypeKind } from '@/lib/unitTypes';
import type { BuildingAmenity } from '@/lib/types';
import type { PhotoView } from '@/components/admin/PhotoManager';
import { PhotoManagerLazy } from '@/components/admin/PhotoManagerLazy';

export const metadata: Metadata = { title: 'Toà nhà' };

export default async function BuildingEditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string; from?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const { created, from } = await searchParams;
  const isNew = id === 'moi';
  if (!isNew && !/^[0-9a-f-]{36}$/.test(id)) notFound();
  const sb = await supabaseServer();

  let b: BuildingData = {
    id: null, slug: '', name: '', aliases: [], code_prefix: '', street: '', maps_url: null, video_url: null, lat: null, lng: null, amenities: [], default_fees: {},
    sort: 0, is_demo: false, ...EMPTY_FEES,
  };
  let copiedFrom: string | null = null;
  let photos: PhotoView[] = [];
  let frozen = false, live = 0, visible = true;
  let demoLeft: string[] = [];
  let meta: { updated_at: string; updated_by: string | null } | null = null;
  // "Nhân bản toà nhà": fees, amenities, default terms and descriptions; NOT name, slug, prefix, aliases, address, coordinates, photos
  if (isNew && from && /^[0-9a-f-]{36}$/.test(from)) {
    const { data: src } = await sb.from('buildings').select('*').eq('id', from).maybeSingle();
    if (src) {
      copiedFrom = src.name;
      const fees = toBuildingFees(src);
      b = {
        ...b, amenities: src.amenities ?? [], default_fees: src.default_fees ?? {},
        sort: src.sort, ...Object.fromEntries(FEE_FIELDS.map((k) => [k, fees[k]])),
      } as BuildingData;
    }
  }
  if (!isNew) {
    const [{ data }, { data: ph }, { count: coded }, { count: liveCount }] = await Promise.all([
      sb.from('buildings').select('*').eq('id', id).maybeSingle(),
      sb.from('photos').select('id, path, thumb_path, visibility, is_cover, width, height, watermark, tag, source, needs_reupload').eq('building_id', id).order('sort'),
      // the prefix is frozen once the building had a public page: an old listing code, or a visible unit type
      sb.from('admin_listings').select('id', { count: 'exact', head: true }).eq('building_id', id).not('code', 'is', null),
      sb.from('admin_unit_types').select('id', { count: 'exact', head: true }).eq('building_id', id).eq('is_visible', true),
    ]);
    live = liveCount ?? 0;
    frozen = (coded ?? 0) + live > 0;
    if (data) demoLeft = [
      !(ph ?? []).length && 'Chưa có ảnh toà nhà',
      (data.lat == null || data.lng == null) && 'Chưa có vị trí (link Google Maps)',
      !data.fee_verified && 'Phí toà nhà chưa xác minh',
    ].filter(Boolean) as string[];
    if (!data) notFound();
    b = { ...(data as BuildingData), ...toBuildingFees(data) };
    meta = data;
    visible = data.is_visible !== false;
    photos = (ph ?? []).map((p) => ({ id: p.id, visibility: 'public', is_cover: p.is_cover, watermark: p.watermark, tag: p.tag, source: p.source, needs_reupload: p.needs_reupload, width: p.width, height: p.height, url: publicPhotoUrl(SUPABASE_URL, p.thumb_path ?? p.path) }));
  }
  const dir = await staffDirectory();
  // generated description preview (as saved): the building's visible types and fees
  const { data: vt } = isNew ? { data: [] } : await sb.from('unit_types').select('type, price_from').eq('building_id', id).eq('is_visible', true);
  const types = (vt ?? []).filter((t) => isUnitTypeKind(t.type) && t.price_from != null).map((t) => ({ type: t.type, priceFrom: Number(t.price_from) }));
  const generated = Object.fromEntries(LOCALES.map((l) => [l, b.name ? describeBuilding({ name: b.name, street: b.street, amenities: b.amenities as BuildingAmenity[], fees: b }, types, l) : ''])) as Record<Locale, string>;

  return (
    <div className="a-page">
      <div className="a-head">
        <div>
          <Link href="/admin/toa-nha" className="a-small" style={{ color: 'var(--blue-500)' }}>← Toà nhà</Link>
          <h1 className="a-h1">{isNew ? 'Thêm toà nhà' : b.name}</h1>
          {meta && <div className="a-sub">Sửa lần cuối {meta.updated_by ? <>bởi <b>{dir.get(meta.updated_by)?.name}</b> </> : ''}lúc {fmtDateTime(meta.updated_at)}</div>}
        </div>
        {!isNew && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <BuildingVisibility id={id} visible={visible} live={live} label />
          <details className="a-menu">
            <summary className="a-btn a-btn-ghost a-btn-sm" aria-label="Thao tác với toà nhà"><MoreHorizontal size={16} aria-hidden /></summary>
            <div role="menu">
              <Link role="menuitem" href={`/admin/toa-nha/moi?from=${id}`}><Copy size={14} aria-hidden /> Nhân bản toà nhà</Link>
              <Link role="menuitem" href={`/admin/loai-can?b=${id}`}>Loại căn của toà</Link>
              <a role="menuitem" href={`/${b.code_prefix}`} target="_blank" rel="noopener"><ExternalLink size={14} aria-hidden /> Xem trên website</a>
              <BuildingDelete id={id} name={b.name} />
            </div>
          </details>
          </div>
        )}
      </div>
      {created && <div className="a-alert ok" style={{ marginBottom: 14 }}>Đã tạo toà nhà kèm 4 loại căn nháp (ẩn). Thêm ảnh bên dưới, rồi điền giá và diện tích ở <Link href={`/admin/loai-can?b=${id}`}>Loại căn</Link>.</div>}
      {copiedFrom && <div className="a-alert info" style={{ marginBottom: 14 }}>Bản sao từ <b>{copiedFrom}</b>: đã chép phí và tiện ích. Nhập tên, đường dẫn, tiền tố mã và địa chỉ rồi bấm Tạo toà nhà.</div>}
      <BuildingForm b={b} demoLeft={demoLeft} frozen={frozen} generated={generated} photos={isNew ? undefined : <PhotoManagerLazy owner={{ kind: 'building', id }} photos={photos} />} />
    </div>
  );
}
