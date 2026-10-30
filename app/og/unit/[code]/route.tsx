import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import sharp from 'sharp';
import { getTranslations } from 'next-intl/server';
import { DEFAULT_LOCALE, PREFIXED, type Locale } from '@/i18n/locales';
import { getBuildings, getUnitType } from '@/lib/repo';
import { money } from '@/lib/format';
import { LOGO } from '@/lib/watermarkLogo';
import { SITE_URL } from '@/data/site';

export const runtime = 'nodejs';
// one image per unit type + language, cached; unit type / photo changes revalidate it (lib/revalidate.ts), 1 h fallback
export const dynamic = 'force-static';
export const revalidate = 3600;

const W = 1200, H = 630;
const font = (w: number) => readFile(join(process.cwd(), `app/fonts/og/NotoSans-${w}.ttf`));
const fonts = Promise.all([font(500), font(800)]);
/** Russian cards: the Cyrillic cut (one weight, used for both) */
const cyr = readFile(join(process.cwd(), 'app/fonts/og/NotoSans-500-cyr.ttf'));

/** hidden / unknown unit type → the generic site image */
const generic = () => Response.redirect(`${SITE_URL}/images/hero-quy-nhon.webp`, 302);

/**
 * Social card of a unit type, 1200×630: /og/unit/alt-2pn (default language) · /og/unit/alt-2pn.en (other languages).
 * Sample-unit cover (else the building's), building + type, "Từ {price}/tháng", "Căn mẫu" tag, ApartQN logo. The
 * default-language card is the one shared in posts (apartqn.com/{CODE}): it carries the English type and price too.
 */
export async function GET(_: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  const m = new RegExp(`^([a-z]{3}-(?:studio|1pn|2pn|3pn))(?:\\.(${PREFIXED.join('|')}))?$`, 'i').exec(raw);
  if (!m) return generic();
  const l = (m[2]?.toLowerCase() as Locale | undefined) ?? DEFAULT_LOCALE;
  const x = await getUnitType(m[1]).catch(() => null);
  if (!x) return generic();
  const b = (await getBuildings().catch(() => [])).find((y) => y.id === x.buildingId);
  const t = await getTranslations({ locale: l });
  const te = l === DEFAULT_LOCALE ? await getTranslations({ locale: 'en' }) : null;

  // satori reads JPEG / PNG: the cover (WebP in storage) is converted here, already cropped to the card
  let cover: string | null = null;
  const src = x.photos[0] ?? b?.photos[0];
  if (src) {
    try {
      const buf = Buffer.from(await (await fetch(src, { signal: AbortSignal.timeout(8000) })).arrayBuffer());
      cover = 'data:image/jpeg;base64,' + (await sharp(buf).resize(W, H, { fit: 'cover' }).jpeg({ quality: 78 }).toBuffer()).toString('base64');
    } catch { /* card without a photo */ }
  }
  const [f500, f800] = l === 'ru' ? await Promise.all([cyr, cyr]) : await fonts;
  const name = b?.name ?? '';
  const [bx, by, bw, bh] = LOGO.box;

  return new ImageResponse(
    (
      <div style={{ width: W, height: H, display: 'flex', position: 'relative', background: '#0B1530', fontFamily: 'Noto Sans', color: '#fff' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {cover && <img src={cover} alt="" width={W} height={H} style={{ position: 'absolute', left: 0, top: 0, objectFit: 'cover' }} />}
        <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, display: 'flex', background: 'linear-gradient(180deg, rgba(11,21,48,.15) 0%, rgba(11,21,48,.25) 40%, rgba(11,21,48,.9) 100%)' }} />
        <div style={{ position: 'absolute', left: 56, top: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: W - 112 }}>
          <svg width={220} height={(220 * bh) / bw} viewBox={`${bx} ${by} ${bw} ${bh}`}><path d={LOGO.apart} fill="#fff" /><path d={LOGO.qn} fill="#fff" /></svg>
          {x.photos.length > 0 && <div style={{ display: 'flex', padding: '10px 22px', borderRadius: 999, background: 'rgba(11,21,48,.7)', fontSize: 28, fontWeight: 800 }}>{t('sampleShort')}</div>}
        </div>
        <div style={{ position: 'absolute', left: 56, bottom: 48, width: W - 112, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 58, fontWeight: 800, lineHeight: 1.12 }}>{name}</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 22 }}>
            <div style={{ display: 'flex', flexDirection: 'column', fontSize: 40, fontWeight: 500 }}>
              <span>{t(`ut_${x.type}`)}</span>
              {te && <span style={{ fontSize: 28, opacity: 0.85 }}>{te(`ut_${x.type}`)}</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', fontSize: 52, fontWeight: 800 }}>
                {t('priceFrom', { price: money(x.priceFrom, l) })}<span style={{ fontSize: 30, fontWeight: 500, marginLeft: 6 }}>{t('perMonth')}</span>
              </div>
              {te && <div style={{ display: 'flex', fontSize: 28, fontWeight: 500, opacity: 0.85 }}>{te('priceFrom', { price: money(x.priceFrom, 'en') })}{te('perMonth')}</div>}
              <div style={{ display: 'flex', fontSize: 22, fontWeight: 500, opacity: 0.8 }}>{t('priceVaries')}</div>
            </div>
          </div>
        </div>
      </div>
    ),
    { width: W, height: H, fonts: [{ name: 'Noto Sans', data: f500, weight: 500, style: 'normal' }, { name: 'Noto Sans', data: f800, weight: 800, style: 'normal' }] },
  );
}
