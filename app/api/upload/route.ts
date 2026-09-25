import { NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { clientIp, rateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';

/**
 * Issues short-lived client tokens so the browser uploads consign photos straight to Vercel Blob
 * (keeps files out of the 4.5 MB function body limit). Only URLs are sent to /api/lead afterwards.
 */
export async function POST(req: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ ok: false, error: 'CONFIG_MISSING' }, { status: 500 });

  let body: HandleUploadBody;
  try {
    body = (await req.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'INVALID' }, { status: 400 });
  }

  // Token requests come from the browser; completion callbacks come from Vercel and are signed.
  if (body.type === 'blob.generate-client-token' && !rateLimit(`upload:${clientIp(req)}`, 30, 10 * 60 * 1000)) {
    return NextResponse.json({ ok: false, error: 'RATE_LIMITED' }, { status: 429 });
  }

  try {
    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        if (!/^consign\/[\w.-]{1,120}$/.test(pathname)) throw new Error('bad pathname');
        return {
          allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp'],
          maximumSizeInBytes: 4 * 1024 * 1024,
          addRandomSuffix: true,
          validUntil: Date.now() + 10 * 60 * 1000,
        };
      },
    });
    return NextResponse.json(json);
  } catch (e) {
    console.error('[upload] failed:', e);
    return NextResponse.json({ ok: false, error: 'INVALID' }, { status: 400 });
  }
}
