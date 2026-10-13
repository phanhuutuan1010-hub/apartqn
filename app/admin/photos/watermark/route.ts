import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase/server';
import { col, setPhotoWatermark, type PhotoOwner, type PhotoRow } from '@/lib/admin/photoPipeline';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const Body = z.object({
  owner: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('listing'), id: z.string().uuid() }),
    z.object({ kind: z.literal('building'), id: z.string().uuid() }),
  ]),
  photoId: z.string().uuid(),
  on: z.boolean(),
  // "Nguồn → Ảnh tham khảo" for a watermarked photo: strip the watermark, then mark it
  reference: z.boolean().optional(),
});
const fail = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });

/**
 * Bulk "Bật / Tắt watermark": the grid's queue calls this once per photo (3 at a time — one sharp render per request fits
 * Vercel Hobby). Re-renders the public pair from the clean master. No revalidation here: the grid refreshes the pages once
 * when the queue is done. Runs as the signed-in staff member (RLS: admins; sales on their own listings).
 */
export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin');
  if (origin && new URL(origin).host !== req.headers.get('host')) return fail(403, 'Forbidden');
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, 'Dữ liệu không hợp lệ.');
  const { photoId, on, reference } = parsed.data;
  const owner = parsed.data.owner as PhotoOwner;

  const sb = await supabaseServer();
  const { data: claims } = await sb.auth.getClaims();
  const uid = claims?.claims?.sub;
  const { data: me } = uid ? await sb.from('profiles').select('role').eq('id', uid).maybeSingle() : { data: null };
  if (!me) return fail(401, 'Phiên đăng nhập đã hết hạn.');
  if (owner.kind === 'building' && me.role !== 'admin') return fail(403, 'Chỉ quản trị viên sửa ảnh toà nhà.');

  const { data: p } = await sb.from('photos').select('*').eq('id', photoId).eq(col(owner), owner.id).maybeSingle();
  if (!p) return fail(404, 'Không tìm thấy ảnh.');
  if (p.visibility !== 'public') return NextResponse.json({ ok: true, skipped: 'internal' });
  // a reference photo is never watermarked
  if (on && (reference || p.source === 'reference')) return NextResponse.json({ ok: true, skipped: 'reference' });
  try {
    if (p.watermark !== on) await setPhotoWatermark(sb, p as PhotoRow, on);
  } catch (e) {
    return fail(500, (e as Error).message);
  }
  if (reference) {
    const { error } = await sb.from('photos').update({ source: 'reference' }).eq('id', photoId);
    if (error) return fail(500, error.message);
  }
  return NextResponse.json({ ok: true });
}
