import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { clientIp, rateLimit } from '@/lib/rateLimit';
import { MAX_PHOTOS } from '@/lib/leadSchema';

export const runtime = 'nodejs';

const Body = z.object({ files: z.array(z.enum(['image/jpeg', 'image/png', 'image/webp'])).min(1).max(MAX_PHOTOS) });
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as const;

/**
 * Issues one-time signed upload URLs into the PRIVATE consign-inbox bucket (<uploadId>/<n>.<ext>).
 * The browser uploads straight to Supabase Storage (no 4.5 MB function body limit);
 * only the paths are sent to /api/lead afterwards.
 */
export async function POST(req: Request) {
  if (!rateLimit(`consign-upload:${clientIp(req)}`, 5, 10 * 60 * 1000)) return NextResponse.json({ ok: false, error: 'RATE_LIMITED' }, { status: 429 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return NextResponse.json({ ok: false, error: 'CONFIG_MISSING' }, { status: 500 });

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ ok: false, error: 'INVALID' }, { status: 400 });
  }
  const { supabaseSecret } = await import('@/lib/supabase/secret');
  const storage = supabaseSecret().storage.from('consign-inbox');
  const uploadId = randomUUID();
  const uploads: { path: string; url: string }[] = [];
  for (const [i, type] of body.files.entries()) {
    const path = `${uploadId}/${i + 1}.${EXT[type]}`;
    const { data, error } = await storage.createSignedUploadUrl(path);
    if (error || !data) {
      console.error('[consign-upload]', error);
      return NextResponse.json({ ok: false, error: 'SEND_FAILED' }, { status: 502 });
    }
    uploads.push({ path, url: data.signedUrl });
  }
  return NextResponse.json({ ok: true, uploadId, uploads });
}
