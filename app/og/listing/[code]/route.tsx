import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import sharp from 'sharp';
import { getBuilding, getListing } from '@/lib/repo';
import { F, money, vnToday } from '@/lib/format';
import { LOGO } from '@/lib/watermarkLogo';
import { SITE_URL } from '@/data/site';

export const runtime = 'nodejs';
// one image per listing + language, cached; listing changes revalidate it (lib/revalidate.ts), 1 h fallback
export const dynamic = 'force-static';
export const revalidate = 3600;

const W = 1200, H = 630;
const font = (w: number) => readFile(join(process.cwd(), `app/fonts/og/NotoSans-${w}.ttf`));
const fonts = Promise.all([font(500), font(800)]);

/** hidden / deleted / unknown listing → the generic site image */
const generic = () => Response.redirect(`${SITE_URL}/images/hero-quy-nhon.webp`, 302);

/**
 * Social card of a listing, 1200×630: /og/listing/alt-001 (Vietnamese) · /og/listing/alt-001.en (English).
 * Cover photo, building + city, bedrooms, floor band, rent, "Dọn vào ngay" badge when it applies, ApartQN logo.
 * Only public-view data: never a floor number or a unit number.
 */
export async function GET(_: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  const m = /^([a-z]{3}-\d{3,6})(\.en)?$/i.exec(raw);
  if (!m) return generic();
  const l = m[2] ? 'en' : 'vi';
  const x = await getListing(m[1]).catch(() => null);
  if (!x) return generic();
  const b = await getBuilding(x.buildingId).catch(() => null);

  // satori reads JPEG / PNG: the cover (WebP in storage) is converted here, already cropped to the card
  let cover: string | null = null;
  const src = x.photos[0] ?? b?.photos[0];
  if (src) {
    try {
      const buf = Buffer.from(await (await fetch(src, { signal: AbortSignal.timeout(8000) })).arrayBuffer());
      cover = 'data:image/jpeg;base64,' + (await sharp(buf).resize(W, H, { fit: 'cover' }).jpeg({ quality: 78 }).toBuffer()).toString('base64');
    } catch { /* card without a photo */ }
  }
  const [f500, f800] = await fonts;
  const name = b?.name ?? '';
  const city = /quy\s*nh[oơ]n/i.test(name) ? '' : l === 'vi' ? 'Quy Nhơn' : 'Quy Nhon';
  const facts = [x.beds === 0 ? 'Studio' : F.bedsLong(x.beds, l), x.floorBand && F.floorBand(x.floorBand, l)].filter(Boolean).join(' · ');
  const now = x.status === 'available' && x.moveIn <= vnToday();
  const [bx, by, bw, bh] = LOGO.box;

  return new ImageResponse(
    (
      <div style={{ width: W, height: H, display: 'flex', position: 'relative', background: '#0B1530', fontFamily: 'Noto Sans', color: '#fff' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {cover && <img src={cover} alt="" width={W} height={H} style={{ position: 'absolute', left: 0, top: 0, objectFit: 'cover' }} />}
        <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, display: 'flex', background: 'linear-gradient(180deg, rgba(11,21,48,.15) 0%, rgba(11,21,48,.25) 40%, rgba(11,21,48,.9) 100%)' }} />
        <div style={{ position: 'absolute', left: 56, top: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: W - 112 }}>
          <svg width={220} height={(220 * bh) / bw} viewBox={`${bx} ${by} ${bw} ${bh}`}><path d={LOGO.apart} fill="#fff" /><path d={LOGO.qn} fill="#fff" /></svg>
          {now && <div style={{ display: 'flex', padding: '10px 22px', borderRadius: 999, background: '#1B8A4B', fontSize: 30, fontWeight: 800 }}>{l === 'vi' ? 'Dọn vào ngay' : 'Available now'}</div>}
        </div>
        <div style={{ position: 'absolute', left: 56, bottom: 48, width: W - 112, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 58, fontWeight: 800, lineHeight: 1.12 }}>{name}</div>
          {city && <div style={{ display: 'flex', fontSize: 30, fontWeight: 500, opacity: 0.9, marginTop: 4 }}>{city}</div>}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 22 }}>
            <div style={{ display: 'flex', fontSize: 38, fontWeight: 500 }}>{facts}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', fontSize: 56, fontWeight: 800 }}>
              {money(x.rent, l)}<span style={{ fontSize: 30, fontWeight: 500, marginLeft: 6 }}>{l === 'vi' ? '/tháng' : '/month'}</span>
            </div>
          </div>
        </div>
      </div>
    ),
    { width: W, height: H, fonts: [{ name: 'Noto Sans', data: f500, weight: 500, style: 'normal' }, { name: 'Noto Sans', data: f800, weight: 800, style: 'normal' }] },
  );
}
