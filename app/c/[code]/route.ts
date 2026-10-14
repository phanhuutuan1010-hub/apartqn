import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Old short links /c/{code}?s=…&v=…&l=… (posts published before listings moved to apartqn.com/{CODE}): 301 to /{CODE}
 * with the same query — the click is counted and attributed there (lib/listingEntry.ts).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const to = new URL(/^[a-z]{3}-\d{3,6}$/i.test(code) ? `/${code.toUpperCase()}` : '/', req.nextUrl.origin);
  to.search = req.nextUrl.search;
  return NextResponse.redirect(to, 301);
}
