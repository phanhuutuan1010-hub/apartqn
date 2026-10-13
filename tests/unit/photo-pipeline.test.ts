import { beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock('@/lib/admin/refresh', () => ({ refresh: vi.fn() }));

const { movePhoto, setPhotoWatermark, renderVariants, masterFromOriginal } = await import('@/lib/admin/photoPipeline');
const { classify, MAX_BYTES } = await import('@/lib/admin/imageInput');
type Row = Parameters<typeof setPhotoWatermark>[1];

/** In-memory Supabase: storage buckets + one photos table. */
function fake() {
  const files = new Map<string, Buffer>();
  const rows = new Map<string, Row>();
  const key = (b: string, p: string) => `${b}/${p}`;
  const sb = {
    storage: {
      from: (b: string) => ({
        download: async (p: string) => (files.has(key(b, p)) ? { data: new Blob([new Uint8Array(files.get(key(b, p))!)]), error: null } : { data: null, error: { message: 'not found' } }),
        upload: async (p: string, d: Buffer) => { files.set(key(b, p), Buffer.from(d)); return { error: null }; },
        remove: async (ps: string[]) => { ps.forEach((p) => files.delete(key(b, p))); return { error: null }; },
      }),
    },
    from: () => ({
      update: (patch: Partial<Row>) => ({ eq: async (_: string, id: string) => { rows.set(id, { ...rows.get(id)!, ...patch }); return { error: null }; } }),
    }),
  };
  return { sb: sb as never, files, rows };
}
const jpeg = () => sharp({ create: { width: 2000, height: 1500, channels: 3, background: '#7aa' } }).jpeg().toBuffer();
const listed = (files: Map<string, Buffer>) => [...files.keys()].sort();

describe('photo pipeline', () => {
  let f: ReturnType<typeof fake>;
  beforeEach(() => { f = fake(); });

  const pub = (pre: string, id: string, sfx: string) => [640, 1200, 1920].map((w) => `listing-public/${pre}${id}-${sfx}-${w}.webp`).sort();

  it('original → master (≤ 2400 px webp), original deleted → three public variants with versioned names', async () => {
    f.files.set('listing-master/listings/L1/orig-p1', await sharp({ create: { width: 4000, height: 3000, channels: 3, background: '#7aa' } }).jpeg().toBuffer());
    const { master, master_path } = await masterFromOriginal(f.sb, 'listings/L1/', 'p1');
    expect(master_path).toBe('listings/L1/p1.webp');
    expect((await sharp(master).metadata()).width).toBe(2400);
    const out = await renderVariants(f.sb, 'listings/L1/', 'p1', master, true);
    expect(out).toMatchObject({ path: 'listings/L1/p1-wm3-1920.webp', thumb_path: 'listings/L1/p1-wm3-640.webp', width: 1920, height: 1440, wm_version: 3 });
    expect(out.variants.map((v) => v.w)).toEqual([640, 1200, 1920]);
    expect(listed(f.files)).toEqual(['listing-master/listings/L1/p1.webp', ...pub('listings/L1/', 'p1', 'wm3')].sort());
  });

  it('a small master is never upscaled', async () => {
    const small = await sharp({ create: { width: 1000, height: 750, channels: 3, background: '#7aa' } }).webp().toBuffer();
    const out = await renderVariants(f.sb, 'buildings/b/', 'p9', small, false);
    expect(out.variants).toEqual([{ w: 640, h: 480, path: 'buildings/b/p9-c3-640.webp' }, { w: 1000, h: 750, path: 'buildings/b/p9-c3-1000.webp' }]);
  });

  it('toggle off → clean re-render from the master, old public files removed; legacy photo gets a master first', async () => {
    // legacy: clean public file, no master
    f.files.set('listing-public/buildings/b/old.webp', await jpeg());
    f.files.set('listing-public/buildings/b/thumbs/old.webp', await jpeg());
    const row: Row = { id: 'p2', listing_id: null, building_id: 'B', bucket: 'listing-public', path: 'buildings/b/old.webp', thumb_path: 'buildings/b/thumbs/old.webp', master_path: null, watermark: false, wm_version: null, visibility: 'public', is_cover: false };
    f.rows.set('p2', row);
    await setPhotoWatermark(f.sb, row, true);
    expect(f.rows.get('p2')).toMatchObject({ watermark: true, wm_version: 3, path: 'buildings/b/p2-wm3-1920.webp', thumb_path: 'buildings/b/p2-wm3-640.webp', master_path: 'buildings/b/p2.webp' });
    expect(listed(f.files)).toEqual(['listing-master/buildings/b/p2.webp', ...pub('buildings/b/', 'p2', 'wm3')].sort());
    await setPhotoWatermark(f.sb, f.rows.get('p2')!, false);
    expect(f.rows.get('p2')).toMatchObject({ watermark: false, path: 'buildings/b/p2-c3-1920.webp' });
    expect(listed(f.files)).toEqual(['listing-master/buildings/b/p2.webp', ...pub('buildings/b/', 'p2', 'c3')].sort());
  });

  it('public → internal keeps a clean copy only; internal → public renders again', async () => {
    f.files.set('listing-master/listings/L1/p3.webp', await jpeg());
    const out = await renderVariants(f.sb, 'listings/L1/', 'p3', await jpeg(), true);
    const row: Row = { id: 'p3', listing_id: 'L1', building_id: null, bucket: 'listing-public', path: out.path, thumb_path: out.thumb_path, variants: out.variants, master_path: 'listings/L1/p3.webp', watermark: true, wm_version: 3, visibility: 'public', is_cover: true };
    f.rows.set('p3', row);
    await movePhoto(f.sb, row, 'internal');
    expect(f.rows.get('p3')).toMatchObject({ bucket: 'listing-internal', visibility: 'internal', master_path: null, is_cover: false, variants: null });
    expect(listed(f.files)).toEqual(['listing-internal/listings/L1/p3.webp', 'listing-internal/listings/L1/thumbs/p3.webp']);
    await expect(setPhotoWatermark(f.sb, f.rows.get('p3')!, true)).rejects.toThrow(/nội bộ/);
    await movePhoto(f.sb, f.rows.get('p3')!, 'public');
    expect(f.rows.get('p3')).toMatchObject({ bucket: 'listing-public', visibility: 'public', path: 'listings/L1/p3-wm3-1920.webp', master_path: 'listings/L1/p3.webp' });
    expect(listed(f.files)).toEqual(['listing-master/listings/L1/p3.webp', ...pub('listings/L1/', 'p3', 'wm3')].sort());
  });
});

describe('upload input', () => {
  const file = (name: string, type: string, size = 1000) => new File([new Uint8Array(size)], name, { type });
  it('accepts JPG/JPEG in any case, PNG, WebP, AVIF, HEIC/HEIF — by MIME or by extension', () => {
    for (const [n, t] of [['a.jpg', 'image/jpeg'], ['B.JPEG', ''], ['c.JPG', ''], ['d.png', 'image/png'], ['e.webp', ''], ['f.avif', 'image/avif'], ['g.HEIC', ''], ['h.heif', 'image/heif'], ['noext', 'image/jpeg']] as const)
      expect(classify(file(n, t)), n).not.toHaveProperty('error');
    expect(classify(file('IMG_0001.HEIC', ''))).toEqual({ kind: 'heic' });
  });
  it('refuses other formats, empty and > 25 MB files with a Vietnamese message', () => {
    expect(classify(file('doc.pdf', 'application/pdf'))).toEqual({ error: expect.stringContaining('.pdf') });
    expect(classify(file('clip.mov', 'video/quicktime'))).toHaveProperty('error');
    expect(classify(file('x.jpg', 'image/jpeg', 0))).toEqual({ error: 'Tệp rỗng' });
    expect(classify(file('big.jpg', 'image/jpeg', MAX_BYTES + 1))).toEqual({ error: expect.stringMatching(/25 MB/) });
  });
});
