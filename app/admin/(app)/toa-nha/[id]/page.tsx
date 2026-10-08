import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import { requireAdmin, staffDirectory } from '@/lib/admin/session';
import { supabaseServer, SUPABASE_URL } from '@/lib/supabase/server';
import { publicPhotoUrl } from '@/lib/repoMap';
import { fmtDateTime } from '@/lib/admin/labels';
import { BuildingForm, type BuildingData } from '@/components/admin/BuildingForm';
import { PhotoManager, type PhotoView } from '@/components/admin/PhotoManager';

export const metadata: Metadata = { title: 'Toà nhà' };

export default async function BuildingEditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const { created } = await searchParams;
  const isNew = id === 'moi';
  if (!isNew && !/^[0-9a-f-]{36}$/.test(id)) notFound();
  const sb = await supabaseServer();

  let b: BuildingData = {
    id: null, slug: '', name: '', aliases: [], code_prefix: '', street: '', ward_new: null, ward_old: null, lat: null, lng: null, amenities: [], default_fees: {},
    desc_vi: null, desc_en: null, desc_ru: null, sort: 0, is_demo: false,
  };
  let photos: PhotoView[] = [];
  let coded = 0;
  let meta: { updated_at: string; updated_by: string | null } | null = null;
  if (!isNew) {
    const [{ data }, { data: ph }, { count }] = await Promise.all([
      sb.from('buildings').select('*').eq('id', id).maybeSingle(),
      sb.from('photos').select('id, path, thumb_path, visibility, is_cover, width, height, watermark').eq('building_id', id).order('sort'),
      sb.from('admin_listings').select('id', { count: 'exact', head: true }).eq('building_id', id).not('code', 'is', null),
    ]);
    coded = count ?? 0;
    if (!data) notFound();
    b = data as BuildingData;
    meta = data;
    photos = (ph ?? []).map((p) => ({ id: p.id, visibility: 'public', is_cover: p.is_cover, watermark: p.watermark, width: p.width, height: p.height, url: publicPhotoUrl(SUPABASE_URL, p.thumb_path ?? p.path) }));
  }
  const dir = await staffDirectory();

  return (
    <div className="a-page">
      <div className="a-head">
        <div>
          <Link href="/admin/toa-nha" className="a-small" style={{ color: 'var(--blue-500)' }}>← Toà nhà</Link>
          <h1 className="a-h1">{isNew ? 'Thêm toà nhà' : b.name}</h1>
          {meta && <div className="a-sub">Sửa lần cuối {meta.updated_by ? <>bởi <b>{dir.get(meta.updated_by)?.name}</b> </> : ''}lúc {fmtDateTime(meta.updated_at)}</div>}
        </div>
        {!isNew && <a className="a-btn a-btn-ghost a-btn-sm" href={`/toa-nha/${b.slug}`} target="_blank" rel="noopener"><ExternalLink size={14} aria-hidden /> Xem trên website</a>}
      </div>
      {created && <div className="a-alert ok" style={{ marginBottom: 14 }}>Đã tạo toà nhà. Thêm ảnh bên dưới.</div>}
      <BuildingForm b={b} codedListings={coded} photos={isNew ? undefined : <PhotoManager owner={{ kind: 'building', id }} photos={photos} />} />
    </div>
  );
}
