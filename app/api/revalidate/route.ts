import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { revalidatePublic } from '@/lib/revalidate';

export const runtime = 'nodejs';

/** /{PREFIX} (a building) or /{PREFIX}-{TYPE} (a unit type) */
const Body = z.object({ pages: z.array(z.string().regex(/^\/[A-Za-z]{3}(-(studio|1pn|2pn|3pn))?$/i)).max(500) });

/** Maintenance scripts (photo backfill) → refresh public pages. Auth: `Authorization: Bearer ${CRON_SECRET}`. */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ ok: false }, { status: 401 });
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ ok: false, error: 'INVALID' }, { status: 400 });
  for (const page of p.data.pages) {
    const key = page.slice(1).toUpperCase();
    revalidatePublic(key.includes('-') ? { codes: [key] } : { building: key });
  }
  if (!p.data.pages.length) revalidatePublic({});
  return NextResponse.json({ ok: true, pages: p.data.pages.length });
}
