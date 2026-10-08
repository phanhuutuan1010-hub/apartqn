import { beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock('@/lib/admin/refresh', () => ({ refresh: vi.fn() }));

const { movePhoto, setPhotoWatermark, renderPublicPair } = await import('@/lib/admin/photoPipeline');
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

  it('new public photo → watermarked pair with versioned names', async () => {
    const out = await renderPublicPair(f.sb, 'listings/L1/', 'p1', await jpeg(), true);
    expect(out).toMatchObject({ path: 'listings/L1/p1-wm1.webp', thumb_path: 'listings/L1/thumbs/p1-wm1.webp', width: 1600, height: 1200, wm_version: 1 });
    expect(listed(f.files)).toEqual(['listing-public/listings/L1/p1-wm1.webp', 'listing-public/listings/L1/thumbs/p1-wm1.webp']);
  });

  it('toggle off → clean re-render from the master, old public files removed; legacy photo gets a master first', async () => {
    // legacy: clean public file, no master
    f.files.set('listing-public/buildings/b/old.webp', await jpeg());
    f.files.set('listing-public/buildings/b/thumbs/old.webp', await jpeg());
    const row: Row = { id: 'p2', listing_id: null, building_id: 'B', bucket: 'listing-public', path: 'buildings/b/old.webp', thumb_path: 'buildings/b/thumbs/old.webp', master_path: null, watermark: false, wm_version: null, visibility: 'public', is_cover: false };
    f.rows.set('p2', row);
    await setPhotoWatermark(f.sb, row, true);
    expect(f.rows.get('p2')).toMatchObject({ watermark: true, wm_version: 1, path: 'buildings/b/p2-wm1.webp', master_path: 'buildings/b/p2.webp' });
    expect(listed(f.files)).toEqual(['listing-master/buildings/b/p2.webp', 'listing-public/buildings/b/p2-wm1.webp', 'listing-public/buildings/b/thumbs/p2-wm1.webp']);
    await setPhotoWatermark(f.sb, f.rows.get('p2')!, false);
    expect(f.rows.get('p2')).toMatchObject({ watermark: false, path: 'buildings/b/p2-c1.webp' });
    expect(listed(f.files)).toEqual(['listing-master/buildings/b/p2.webp', 'listing-public/buildings/b/p2-c1.webp', 'listing-public/buildings/b/thumbs/p2-c1.webp']);
  });

  it('public → internal keeps a clean copy only; internal → public renders again', async () => {
    f.files.set('listing-master/listings/L1/p3.webp', await jpeg());
    const out = await renderPublicPair(f.sb, 'listings/L1/', 'p3', await jpeg(), true);
    const row: Row = { id: 'p3', listing_id: 'L1', building_id: null, bucket: 'listing-public', path: out.path, thumb_path: out.thumb_path, master_path: 'listings/L1/p3.webp', watermark: true, wm_version: 1, visibility: 'public', is_cover: true };
    f.rows.set('p3', row);
    await movePhoto(f.sb, row, 'internal');
    expect(f.rows.get('p3')).toMatchObject({ bucket: 'listing-internal', visibility: 'internal', master_path: null, is_cover: false });
    expect(listed(f.files)).toEqual(['listing-internal/listings/L1/p3.webp', 'listing-internal/listings/L1/thumbs/p3.webp']);
    await expect(setPhotoWatermark(f.sb, f.rows.get('p3')!, true)).rejects.toThrow(/nội bộ/);
    await movePhoto(f.sb, f.rows.get('p3')!, 'public');
    expect(f.rows.get('p3')).toMatchObject({ bucket: 'listing-public', visibility: 'public', path: 'listings/L1/p3-wm1.webp', master_path: 'listings/L1/p3.webp' });
    expect(listed(f.files)).toEqual(['listing-master/listings/L1/p3.webp', 'listing-public/listings/L1/p3-wm1.webp', 'listing-public/listings/L1/thumbs/p3-wm1.webp']);
  });
});
