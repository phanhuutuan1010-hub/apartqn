import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import qrcode from 'qrcode-generator';
import { getListing } from '@/lib/repo';
import { LOGO } from '@/lib/watermarkLogo';
import { CANONICAL_URL } from '@/data/site';
import { MKP_RU, mkpLink } from '@/lib/listing/marketplace';

export const runtime = 'nodejs';
// one card per listing, cached; listing changes revalidate it (lib/revalidate.ts), 1 h fallback
export const dynamic = 'force-static';
export const revalidate = 3600;

const S = 1080;
const font = (w: number) => readFile(join(process.cwd(), `app/fonts/og/NotoSans-${w}.ttf`));
// + a tiny Cyrillic subset (only the glyphs of the Russian line: "Все фото и расходы: apartqn.com/{CODE}") for this image
const fonts = Promise.all([font(500), font(800), readFile(join(process.cwd(), 'app/fonts/og/NotoSans-500-cyr.ttf'))]);

/** QR as one SVG path (drawn on the server; the library never reaches the browser) */
function qrPath(text: string) {
  const q = qrcode(0, 'M');
  q.addData(text);
  q.make();
  const n = q.getModuleCount();
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  return { n, d };
}

/**
 * Brand card for a Facebook Marketplace post, 1080×1080 PNG: /og/marketplace/alt-003 — the LAST photo of the post.
 * Logo, "see all {n} photos + monthly costs at apartqn.com" (vi + en + ru), the listing code, a QR to the listing's short
 * link (counted as a Marketplace click). Text names the site; the only link is inside the QR.
 */
export async function GET(_: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  if (!/^[a-z]{3}-\d{3,6}$/i.test(raw)) return new Response('Not found', { status: 404 });
  const x = await getListing(raw).catch(() => null);
  if (!x) return new Response('Not found', { status: 404 });
  const n = x.photos.length;
  const { n: size, d } = qrPath(mkpLink(CANONICAL_URL, x.code));
  const [f500, f800, cyr] = await fonts;
  const [bx, by, bw, bh] = LOGO.box;
  const Q = 340;

  return new ImageResponse(
    (
      <div style={{ width: S, height: S, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '84px 72px 76px', background: '#0039A6', fontFamily: 'Noto Sans', color: '#fff' }}>
        <svg width={420} height={(420 * bh) / bw} viewBox={`${bx} ${by} ${bw} ${bh}`}><path d={LOGO.apart} fill="#fff" /><path d={LOGO.qn} fill="#fff" /></svg>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ display: 'flex', fontSize: 50, fontWeight: 800, lineHeight: 1.25, textAlign: 'center', maxWidth: 900 }}>
            {n > 1 ? `Xem đủ ${n} ảnh + chi phí hằng tháng tại apartqn.com` : 'Xem ảnh + chi phí hằng tháng tại apartqn.com'}
          </div>
          <div style={{ display: 'flex', fontSize: 34, fontWeight: 500, lineHeight: 1.3, marginTop: 18, opacity: 0.92, textAlign: 'center', maxWidth: 900 }}>
            {n > 1 ? `All ${n} photos + monthly costs at apartqn.com` : 'Photos + monthly costs at apartqn.com'}
          </div>
          <div style={{ display: 'flex', fontFamily: 'Noto Sans Cyr', fontSize: 34, fontWeight: 500, lineHeight: 1.3, marginTop: 8, opacity: 0.92, textAlign: 'center', maxWidth: 900 }}>
            {`${MKP_RU.card} apartqn.com/${x.code}`}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 44 }}>
          <div style={{ display: 'flex', padding: 44, borderRadius: 28, background: '#fff' }}>
            <svg width={Q} height={Q} viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges"><path d={d} fill="#0B1530" /></svg>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 30, fontWeight: 500, opacity: 0.85 }}>Mã căn · Code</div>
            <div style={{ display: 'flex', fontSize: 84, fontWeight: 800, lineHeight: 1.1 }}>{x.code}</div>
            <div style={{ display: 'flex', fontSize: 30, fontWeight: 500, marginTop: 14, opacity: 0.92 }}>Quét mã để xem căn</div>
            <div style={{ display: 'flex', fontSize: 26, fontWeight: 500, opacity: 0.8 }}>Scan to open the listing</div>
            <div style={{ display: 'flex', fontSize: 30, fontWeight: 800, marginTop: 18 }}>apartqn.com/{x.code}</div>
          </div>
        </div>
      </div>
    ),
    { width: S, height: S, fonts: [{ name: 'Noto Sans', data: f500, weight: 500, style: 'normal' }, { name: 'Noto Sans', data: f800, weight: 800, style: 'normal' }, { name: 'Noto Sans Cyr', data: cyr, weight: 500, style: 'normal' }] },
  );
}
