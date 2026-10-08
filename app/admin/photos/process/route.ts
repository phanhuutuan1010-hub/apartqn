import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase/server';
import { BUCKET, col, download, refreshOwner, removeFiles, renderPublicPair, type PhotoOwner } from '@/lib/admin/photoPipeline';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const Body = z.object({
  owner: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('listing'), id: z.string().uuid() }),
    z.object({ kind: z.literal('building'), id: z.string().uuid() }),
  ]),
  photoId: z.string().uuid(),
});
const fail = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });

/**
 * ONE uploaded master (listing-master/<prefix><photoId>.webp, put there through a signed URL) → public 1600 + 600 px,
 * watermarked by default for listing photos (lib/watermark.ts), + the photos row. Runs as the signed-in staff member:
 * storage and table RLS decide what they may touch.
 */
export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin');
  if (origin && new URL(origin).host !== req.headers.get('host')) return fail(403, 'Forbidden');
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, 'Dữ liệu không hợp lệ.');
  const { owner, photoId } = parsed.data as { owner: PhotoOwner; photoId: string };

  const sb = await supabaseServer();
  const { data: claims } = await sb.auth.getClaims();
  const uid = claims?.claims?.sub;
  // RLS returns the own profile only while active
  const { data: me } = uid ? await sb.from('profiles').select('role').eq('id', uid).maybeSingle() : { data: null };
  if (!me) return fail(401, 'Phiên đăng nhập đã hết hạn.');
  if (owner.kind === 'building' && me.role !== 'admin') return fail(403, 'Chỉ quản trị viên sửa ảnh toà nhà.');

  let prefix: string;
  if (owner.kind === 'listing') {
    const { data } = await sb.from('listings').select('id').eq('id', owner.id).maybeSingle(); // RLS: own listings only
    if (!data) return fail(404, 'Không tìm thấy căn.');
    prefix = `listings/${owner.id}/`;
  } else {
    const { data } = await sb.from('buildings').select('slug').eq('id', owner.id).maybeSingle();
    if (!data) return fail(404, 'Không tìm thấy toà nhà.');
    prefix = `buildings/${data.slug}/`;
  }
  const master_path = `${prefix}${photoId}.webp`;
  const watermark = owner.kind === 'listing';

  let out: Awaited<ReturnType<typeof renderPublicPair>>;
  try {
    const master = await download(sb, BUCKET.master, master_path);
    out = await renderPublicPair(sb, prefix, photoId, master, watermark);
  } catch (e) {
    return fail(500, (e as Error).message);
  }
  const { data: existing } = await sb.from('photos').select('sort, is_cover').eq(col(owner), owner.id);
  const { error } = await sb.from('photos').insert({
    id: photoId, [col(owner)]: owner.id, bucket: BUCKET.public, visibility: 'public',
    path: out.path, thumb_path: out.thumb_path, width: out.width, height: out.height,
    master_path, watermark, wm_version: out.wm_version,
    sort: Math.max(-1, ...(existing ?? []).map((p) => p.sort)) + 1,
    is_cover: !(existing ?? []).some((p) => p.is_cover),
  });
  if (error) {
    await removeFiles(sb, BUCKET.public, [out.path, out.thumb_path]);
    return fail(error.code === '23505' ? 409 : 500, error.code === '23505' ? 'Ảnh đã được xử lý.' : error.message);
  }
  await refreshOwner(sb, owner);
  return NextResponse.json({ ok: true, id: photoId });
}
