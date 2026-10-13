'use client';
/**
 * Admin photo input: accept common camera / phone formats.
 *   JPG/JPEG (any case), PNG, WebP, AVIF, HEIC/HEIF (iPhone; decoded with heic2any, loaded only when needed).
 * Checks MIME OR extension (browsers often report "" for HEIC).
 * Public photos: the ORIGINAL file is uploaded untouched (prepareOriginal) — no downscale, no re-compression in the
 * browser. Only HEIC is converted (JPEG q95): the server cannot read it. The server applies the EXIF orientation, drops
 * all metadata (GPS) when it makes the master, and deletes the original (lib/admin/photoPipeline.ts).
 * Internal photos (never public) are still converted here (prepareImage).
 */

export const MAX_BYTES = 25 * 1024 * 1024;
export const MAX_FILES = 40;
export const ACCEPT = 'image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.avif,.heic,.heif';

const EXT: Record<string, Kind> = { jpg: 'raster', jpeg: 'raster', jfif: 'raster', png: 'raster', webp: 'raster', avif: 'raster', heic: 'heic', heif: 'heic' };
const MIME: Record<string, Kind> = {
  'image/jpeg': 'raster', 'image/jpg': 'raster', 'image/pjpeg': 'raster', 'image/png': 'raster', 'image/webp': 'raster', 'image/avif': 'raster',
  'image/heic': 'heic', 'image/heif': 'heic', 'image/heic-sequence': 'heic', 'image/heif-sequence': 'heic',
};
type Kind = 'raster' | 'heic';

const mb = (n: number) => (n / 1048576).toLocaleString('vi-VN', { maximumFractionDigits: 1 });

/** Which pipeline a file needs, or a Vietnamese reason why it is refused. */
export function classify(f: File): { kind: Kind } | { error: string } {
  const ext = (f.name.split('.').pop() ?? '').toLowerCase();
  const kind = MIME[f.type.toLowerCase()] ?? EXT[ext];
  if (!kind) return { error: `Định dạng không hỗ trợ${ext ? ` (.${ext})` : ''} — dùng JPG, PNG, HEIC, WebP hoặc AVIF` };
  if (f.size > MAX_BYTES) return { error: `Ảnh ${mb(f.size)} MB, vượt giới hạn 25 MB` };
  if (f.size === 0) return { error: 'Tệp rỗng' };
  return { kind };
}

/** Decode to something drawable, with EXIF orientation applied. */
async function decode(blob: Blob): Promise<{ img: CanvasImageSource; width: number; height: number; close: () => void }> {
  try {
    const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    return { img: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
  } catch {
    // older Safari: <img> applies EXIF orientation (image-orientation: from-image is the default everywhere)
    const url = URL.createObjectURL(blob);
    try {
      const el = new Image();
      el.decoding = 'async';
      el.src = url;
      await el.decode();
      return { img: el, width: el.naturalWidth, height: el.naturalHeight, close: () => URL.revokeObjectURL(url) };
    } catch {
      URL.revokeObjectURL(url);
      throw new Error('Không đọc được ảnh (tệp hỏng hoặc trình duyệt chưa hỗ trợ định dạng này)');
    }
  }
}

async function heicToJpeg(file: Blob): Promise<Blob> {
  try {
    const { default: heic2any } = await import('heic2any');
    const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.95 });
    return Array.isArray(out) ? out[0] : out;
  } catch {
    throw new Error('Không đọc được ảnh HEIC, hãy xuất sang JPG');
  }
}

/** What is uploaded for a public photo: the file itself, or a JPEG when it is HEIC. */
export async function prepareOriginal(file: File): Promise<{ blob: Blob; type: string }> {
  const c = classify(file);
  if ('error' in c) throw new Error(c.error);
  if (c.kind === 'raster') {
    const ext = (file.name.split('.').pop() ?? '').toLowerCase();
    const type = file.type || { png: 'image/png', webp: 'image/webp', avif: 'image/avif' }[ext] || 'image/jpeg';
    return { blob: file, type: type === 'image/jpg' || type === 'image/pjpeg' ? 'image/jpeg' : type };
  }
  try {
    return { blob: await heicToJpeg(file), type: 'image/jpeg' };
  } catch (e) {
    // Safari decodes HEIC itself: full-size JPEG from the canvas
    const d = await decode(file).catch(() => { throw e; });
    const canvas = document.createElement('canvas');
    canvas.width = d.width;
    canvas.height = d.height;
    canvas.getContext('2d')?.drawImage(d.img, 0, 0);
    d.close();
    const jpg = await encode(canvas, 'image/jpeg', 0.95);
    if (!jpg) throw e;
    return { blob: jpg, type: 'image/jpeg' };
  }
}

const encode = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((res) => canvas.toBlob(res, type, quality));

export type Prepared = { blob: Blob; width: number; height: number; type: 'image/webp' | 'image/jpeg'; ext: 'webp' | 'jpg' };

/**
 * File → clean image ≤ maxEdge px (orientation applied, metadata stripped). WebP when the browser can encode it,
 * otherwise JPEG (Safari). Transparent PNGs keep alpha in WebP; JPEG fallback puts them on white.
 */
export async function prepareImage(file: File, maxEdge = 1600, quality = 0.82): Promise<Prepared> {
  const c = classify(file);
  if ('error' in c) throw new Error(c.error);
  let src: Blob = file;
  if (c.kind === 'heic') {
    // Safari 17+ decodes HEIC natively; everyone else needs heic2any
    try {
      const d = await decode(file);
      d.close();
    } catch {
      src = await heicToJpeg(file);
    }
  }
  const d = await decode(src);
  const scale = Math.min(1, maxEdge / Math.max(d.width, d.height));
  const width = Math.max(1, Math.round(d.width * scale)), height = Math.max(1, Math.round(d.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) { d.close(); throw new Error('Trình duyệt không hỗ trợ xử lý ảnh'); }
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(d.img, 0, 0, width, height);
  d.close();
  const webp = await encode(canvas, 'image/webp', quality);
  if (webp && webp.type === 'image/webp') return { blob: webp, width, height, type: 'image/webp', ext: 'webp' };
  // Safari: no WebP encoder → JPEG (flatten transparency on white)
  ctx.globalCompositeOperation = 'destination-over';
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  const jpg = await encode(canvas, 'image/jpeg', Math.min(0.92, quality + 0.08));
  if (!jpg) throw new Error('Không nén được ảnh');
  return { blob: jpg, width, height, type: 'image/jpeg', ext: 'jpg' };
}
