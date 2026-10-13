/**
 * Public photo rendering + watermark — the ONE place to change it. Bump `version` and run `npm run photos:watermark`
 * to regenerate every public photo from its clean master (new file names → no stale CDN copies).
 * Server / scripts only (sharp). Internal photos are never watermarked and never public.
 */
import sharp from 'sharp';
import { WM_MARK } from './watermarkLogo';

export const WATERMARK = {
  version: 3,
  /** what the mark says (outlines in lib/watermarkLogo.ts — change both together) */
  text: 'apartqn.com',
  /** logo width as a share of the image width, never below `minWidth` px */
  widthRatio: 0.2,
  minWidth: 120,
  /** vertical centre of the logo (0 = top, 1 = bottom): lower third */
  centerY: 0.7,
  /** white text opacity */
  opacity: 0.33,
  /** soft dark halo behind it so it reads on bright photos */
  shadowOpacity: 0.35,
  /** blur radius as a share of the logo height */
  shadowBlur: 0.06,
  copyright: '© ApartQN',
} as const;

/**
 * Public files of one photo: WebP at these widths (never upscaled — a 1000 px master gives 640 + 1000), rendered ONCE
 * from the master. The site serves them with its own srcset; nothing re-compresses them afterwards.
 */
export const PUBLIC_WIDTHS = [640, 1200, 1920] as const;
export const PUBLIC_QUALITY = 85;
/** A source narrower than this cannot fill a phone screen sharply: the photo is flagged "tải lại ảnh gốc" in the admin. */
export const MIN_SOURCE_WIDTH = 1200;
/**
 * Clean master kept in listing-master (for later re-renders, e.g. watermark on/off): ≤ 2400 px wide and ≤ 3200 px tall,
 * so a portrait phone photo keeps a 1920 px variant.
 */
export const MASTER = { edge: 2400, tall: 3200, quality: 90 } as const;

/** Full-image SVG overlay for a w×h image. */
export function watermarkSvg(w: number, h: number): Buffer {
  const W = WATERMARK;
  const [bx, by, bw, bh] = WM_MARK.box;
  const lw = Math.min(w * 0.9, Math.max(W.minWidth, w * W.widthRatio));
  const s = lw / bw;
  const lh = bh * s;
  const x = (w - lw) / 2 - bx * s;
  const y = h * W.centerY - lh / 2 - by * s;
  const blur = Math.max(1, lh * W.shadowBlur);
  const logo = `<path d="${WM_MARK.apart}"/><path d="${WM_MARK.rest}"/>`;
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

/** The widths a master of this width is rendered at: the standard ones below it, then its own width (capped at the largest). */
export function variantWidths(masterWidth: number): number[] {
  const top = Math.min(masterWidth, PUBLIC_WIDTHS[PUBLIC_WIDTHS.length - 1]);
  return [...PUBLIC_WIDTHS.filter((w) => w < top), top];
}

/** Clean master → one public webp `width` px wide (lanczos, light sharpen, watermarked unless `watermark` is false, © metadata). */
export async function renderVariant(master: Buffer, width: number, watermark: boolean) {
  const src = sharp(master).rotate();
  const down = (await imageWidth(master)) > width;
  const base = await (down ? src.resize({ width, kernel: 'lanczos3', withoutEnlargement: true }).sharpen({ sigma: 0.5 }) : src)
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = base.info;
  let img = sharp(base.data);
  if (watermark) img = img.composite([{ input: watermarkSvg(w, h), top: 0, left: 0 }]);
  const data = await img
    .webp({ quality: PUBLIC_QUALITY, effort: 5 })
    .withExif({ IFD0: { Copyright: WATERMARK.copyright, Artist: 'ApartQN' } })
    .withXmp(XMP)
    .toBuffer();
  return { data, width: w, height: h };
}

/** Width after EXIF orientation. */
export async function imageWidth(buf: Buffer): Promise<number> {
  const m = await sharp(buf).metadata();
  return ((m.orientation ?? 1) >= 5 ? m.height : m.width) ?? 0;
}

/** Uploaded original (JPEG / PNG / WebP / AVIF, any size) → clean master: orientation applied, ≤ 2400 × 3200 px, no camera metadata (GPS). */
export async function renderMaster(input: Buffer) {
  const { data, info } = await sharp(input).rotate().resize({ width: MASTER.edge, height: MASTER.tall, fit: 'inside', withoutEnlargement: true, kernel: 'lanczos3' })
    .webp({ quality: MASTER.quality, effort: 5 }).toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/** Clean 640 px thumb (internal photos shown in admin). */
export async function renderCleanThumb(input: Buffer) {
  return sharp(input).rotate().resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
}

/** Public file names carry the variant: -wm{version} when watermarked, -c{version} when not. */
export const publicSuffix = (watermark: boolean) => (watermark ? `-wm${WATERMARK.version}` : `-c${WATERMARK.version}`);
