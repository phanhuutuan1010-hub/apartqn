import { NextResponse, type NextRequest } from 'next/server';
import { listingTarget, redirectStatus } from '@/lib/listingRedirect';
import { parseUnitTypeCode } from '@/lib/unitTypes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Old short links /c/{code}?s=…&v=…&l=… (posts of the listings era): a listing code → the unit type it belongs to (or
 * its building), a unit type code → its page; the query is kept, so the post is still attributed there (lib/entry.ts).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const type = parseUnitTypeCode(code);
  const target = type ? type.code : /^[a-z]{3}-\d{1,6}$/i.test(code) ? await listingTarget(code.replace(/^([a-z]{3})-(\d+)$/i, (_, p: string, n: string) => `${p}-${n.padStart(3, '0')}`)) : null;
  const to = new URL(target ? `/${target}` : '/', req.nextUrl.origin);
  to.search = req.nextUrl.search;
  return NextResponse.redirect(to, target ? redirectStatus(target) : 302);
}
