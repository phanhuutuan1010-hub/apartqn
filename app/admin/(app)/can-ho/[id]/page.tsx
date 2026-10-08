import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import { requireStaff, staffDirectory } from '@/lib/admin/session';
import { supabaseServer, SUPABASE_URL } from '@/lib/supabase/server';
import { publicPhotoUrl } from '@/lib/repoMap';
import { STATUS_LABEL, STATUS_TONE, fmtDateTime, daysSince, type ListingStatusAll } from '@/lib/admin/labels';
import { ListingForm, type BuildingOpt, type ListingData, type UnitData } from '@/components/admin/ListingForm';
import { PhotoManager, type PhotoView } from '@/components/admin/PhotoManager';
import { ListingRowActions } from '@/components/admin/ListingRowActions';

export const metadata: Metadata = { title: 'Sửa căn' };

export default async function EditListingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const { id } = await params;
  const { created } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const me = await requireStaff();
  const sb = await supabaseServer();

  // one round trip: listing + its unit (join) in parallel with buildings, photos and the staff directory
  const [{ data: row }, { data: buildings }, { data: photoRows }, dir] = await Promise.all([
    sb.from('listings').select('*, unit:units(building_id, floor, unit_no, owner_name, owner_phone, owner_notes, assigned_to)').eq('id', id).maybeSingle(),
    sb.from('buildings').select('id, name, slug, default_fees').order('sort'),
    sb.from('photos').select('id, bucket, path, thumb_path, visibility, is_cover, sort, width, height').eq('listing_id', id).order('sort'),
    staffDirectory(),
  ]);
  if (!row) notFound(); // not found OR not yours (RLS)
  const { unit, ...listing } = row as typeof row & { unit: UnitData | null };
  if (!unit) notFound();

  // thumbnails: public URL, or short-lived signed URL for internal photos
  const internal = (photoRows ?? []).filter((p) => p.visibility === 'internal').map((p) => p.thumb_path ?? p.path);
  const signed = new Map<string, string>();
  if (internal.length) {
    const { data } = await sb.storage.from('listing-internal').createSignedUrls(internal, 3600);
    (data ?? []).forEach((d) => d.signedUrl && d.path && signed.set(d.path, d.signedUrl));
  }
  const photos: PhotoView[] = (photoRows ?? []).map((p) => ({
    id: p.id, visibility: p.visibility, is_cover: p.is_cover, width: p.width, height: p.height,
    url: p.visibility === 'public' ? publicPhotoUrl(SUPABASE_URL, p.thumb_path ?? p.path) : signed.get(p.thumb_path ?? p.path) ?? '',
  }));

  const status = listing.status as ListingStatusAll;
  const building = (buildings ?? []).find((b) => b.id === unit.building_id);
  const editor = listing.updated_by ? dir.get(listing.updated_by)?.name : null;
  const vd = daysSince(listing.verified_at);
  const isPublic = status === 'available' || status === 'reserved' || status === 'rented';

  return (
    <div className="a-page">
      <div className="a-head">
        <div>
          <Link href="/admin/can-ho" className="a-small" style={{ color: 'var(--blue-500)' }}>← Căn hộ</Link>
          <h1 className="a-h1" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {listing.code ?? 'Căn mới (chưa có mã)'}
            <span className={`a-badge dot ${STATUS_TONE[status]}`}>{STATUS_LABEL[status]}</span>
            {listing.is_demo && <span className="a-badge outline">demo</span>}
          </h1>
          <div className="a-sub">
            {building?.name} · Tầng {unit.floor} · Căn {unit.unit_no}
            {' · '}Sửa lần cuối {editor ? <>bởi <b>{editor}</b> </> : ''}lúc {fmtDateTime(listing.updated_at)}
            {isPublic && vd != null && <> · Xác nhận còn trống {vd === 0 ? 'hôm nay' : `${vd} ngày trước`}</>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {isPublic && listing.code && (
            <a className="a-btn a-btn-ghost a-btn-sm" href={`/can-ho/${listing.code.toLowerCase()}`} target="_blank" rel="noopener"><ExternalLink size={14} aria-hidden /> Xem trên website</a>
          )}
          <ListingRowActions id={id} status={status} role={me.role} canPublish={me.can_publish} />
        </div>
      </div>

      {created && <div className="a-alert ok" style={{ marginBottom: 14 }}>Đã tạo nháp. Điền thông tin, thêm ảnh rồi bấm “{me.can_publish || me.role === 'admin' ? 'Đăng ngay' : 'Gửi duyệt'}”.</div>}
      {status === 'draft' && listing.rejection_reason && (
        <div className="a-alert error" style={{ marginBottom: 14 }}><b>Bị từ chối:</b> {listing.rejection_reason}</div>
      )}
      {status === 'pending' && <div className="a-alert warn" style={{ marginBottom: 14 }}>Đang chờ quản trị viên duyệt. Bạn vẫn có thể sửa; chọn “Nháp” ở ô trạng thái để rút lại.</div>}

      <ListingForm
        listing={listing as ListingData}
        unit={unit as UnitData}
        buildings={(buildings ?? []) as BuildingOpt[]}
        staff={[...dir.values()].filter((s) => s.active).map((s) => ({ value: s.id, label: s.name }))}
        isAdmin={me.role === 'admin'}
        canPublish={me.role === 'admin' || me.can_publish}
        photos={<PhotoManager owner={{ kind: 'listing', id }} photos={photos} />}
      />
    </div>
  );
}
