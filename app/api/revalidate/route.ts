import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { revalidatePublic } from '@/lib/revalidate';

export const runtime = 'nodejs';

const Body = z.object({ pages: z.array(z.string().regex(/^\/(can-ho\/[a-z]{3}-\d{3,}|toa-nha\/[a-z0-9-]{2,40})$/)).max(500) });

/** Maintenance scripts (photo backfill) → refresh public pages. Auth: `Authorization: Bearer ${CRON_SECRET}`. */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ ok: false }, { status: 401 });
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ ok: false, error: 'INVALID' }, { status: 400 });
  for (const page of p.data.pages) {
    const [, kind, key] = page.split('/');
    revalidatePublic(kind === 'can-ho' ? { code: key } : { building: key });
  }
  if (!p.data.pages.length) revalidatePublic({});
  return NextResponse.json({ ok: true, pages: p.data.pages.length });
}
