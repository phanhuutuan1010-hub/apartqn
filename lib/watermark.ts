/**
 * Public photo watermark — the ONE place to change it. Bump `version` and run `npm run photos:watermark`
 * to regenerate every public photo from its clean master (new file names → no stale CDN copies).
 * Server / scripts only (sharp). Internal photos are never watermarked and never public.
 */
import sharp from 'sharp';
import { LOGO } from './watermarkLogo';

export const WATERMARK = {
  version: 1,
  /** logo width as a share of the image width, never below `minWidth` px */
  widthRatio: 0.2,
  minWidth: 120,
  /** vertical centre of the logo (0 = top, 1 = bottom): lower third */
  centerY: 0.7,
  /** white wordmark opacity */
  opacity: 0.28,
  /** soft dark halo behind it so it reads on bright photos */
  shadowOpacity: 0.35,
  /** blur radius as a share of the logo height */
  shadowBlur: 0.06,
  copyright: '© ApartQN',
} as const;

/** Output sizes for public files (long edge, webp quality) — same as the existing upload pipeline. */
export const PUBLIC_SIZES = { full: { edge: 1600, quality: 82 }, thumb: { edge: 600, quality: 78 } } as const;

/** Full-image SVG overlay for a w×h image. */
export function watermarkSvg(w: number, h: number): Buffer {
  const W = WATERMARK;
  const [bx, by, bw, bh] = LOGO.box;
  const lw = Math.min(w * 0.9, Math.max(W.minWidth, w * W.widthRatio));
  const s = lw / bw;
  const lh = bh * s;
  const x = (w - lw) / 2 - bx * s;
  const y = h * W.centerY - lh / 2 - by * s;
  const blur = Math.max(1, lh * W.shadowBlur);
  const logo = `<path d="${LOGO.apart}"/><path d="${LOGO.qn}"/>`;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
      `<defs><filter id="b" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="${(blur / s).toFixed(2)}"/></filter></defs>` +
      `<g transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${s.toFixed(5)})">` +
      `<g fill="#000" fill-opacity="${W.shadowOpacity}" filter="url(#b)" transform="translate(0 ${(lh * 0.04 / s).toFixed(1)})">${logo}</g>` +
      `<g fill="#fff" fill-opacity="${W.opacity}">${logo}</g>` +
      `</g></svg>`,
  );
}

const XMP = `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">` +
  `<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xmpRights="http://ns.adobe.com/xap/1.0/rights/">` +
  `<dc:rights><rdf:Alt><rdf:li xml:lang="x-default">${WATERMARK.copyright}</rdf:li></rdf:Alt></dc:rights><dc:creator><rdf:Seq><rdf:li>ApartQN</rdf:li></rdf:Seq></dc:creator>` +
  `<xmpRights:Marked>True</xmpRights:Marked></rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`;

/** Clean master → one public webp (resized, watermarked unless `watermark` is false, © metadata). */
export async function renderPublic(master: Buffer, size: keyof typeof PUBLIC_SIZES, watermark: boolean) {
  const { edge, quality } = PUBLIC_SIZES[size];
  const base = await sharp(master).rotate().resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true }).toBuffer({ resolveWithObject: true });
  const { width, height } = base.info;
  let img = sharp(base.data);
  if (watermark) img = img.composite([{ input: watermarkSvg(width, height), top: 0, left: 0 }]);
  const data = await img
    .webp({ quality })
    .withExif({ IFD0: { Copyright: WATERMARK.copyright, Artist: 'ApartQN' } })
    .withXmp(XMP)
    .toBuffer();
  return { data, width, height };
}

/** Clean master for listing-master: ≤ 1600 px webp, no metadata from the camera (GPS etc. stripped). */
export async function renderMaster(input: Buffer) {
  const { data, info } = await sharp(input).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 88 }).toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/** Clean 600 px thumb (internal photos shown in admin). */
export async function renderCleanThumb(input: Buffer) {
  return sharp(input).rotate().resize({ width: 600, height: 600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
}

/** Public file names carry the variant: -wm{version} when watermarked, -c{version} when not. */
export const publicSuffix = (watermark: boolean) => (watermark ? `-wm${WATERMARK.version}` : `-c${WATERMARK.version}`);
