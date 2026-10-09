import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/** What "Nhân bản căn hộ" carries over: specs, fees + overrides, terms, VI/EN descriptions. Never code / status / verification. */
const COPY = [
  'area', 'beds', 'baths', 'dir', 'view', 'furn',
  'rent', 'deposit', 'cycle', 'mgmt', 'moto', 'car', 'net', 'elec', 'water', 'car_parking', 'fee_overrides', 'mgmt_fee_paid_by',
  'min_term', 'max_occ', 'pets', 'temp_reg',
  'desc_vi', 'desc_en',
] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = SupabaseClient<any, any, any>;

/**
 * Fill the freshly created draft `to` from listing `from`. Runs as the signed-in staff member, so RLS decides:
 * sales can only read their own source listing / unit / photos; owner data is copied only when readable.
 */
export async function copyListing(sb: Sb, from: string, to: string, opts: { photos: boolean; owner: boolean }) {
  const { data: src, error } = await sb.from('listings').select(['unit_id', ...COPY].join(', ')).eq('id', from).maybeSingle();
  if (error || !src) throw new Error('Không đọc được căn gốc (hoặc bạn không phụ trách căn đó).');
  const s = src as unknown as Record<string, unknown>;
  const patch = Object.fromEntries(COPY.map((k) => [k, s[k]]));
  const { error: e1 } = await sb.from('listings').update(patch).eq('id', to);
  if (e1) throw new Error(e1.message);

  if (opts.owner) {
    const { data: srcUnit } = await sb.from('units').select('owner_name, owner_phone, owner_notes').eq('id', s.unit_id as string).maybeSingle();
    const { data: dst } = await sb.from('listings').select('unit_id').eq('id', to).single();
    if (srcUnit && dst) {
      const { error: e2 } = await sb.from('units').update(srcUnit).eq('id', dst.unit_id);
      if (e2) throw new Error(e2.message);
    }
  }

  let copied = 0;
  if (opts.photos) {
    const { data: photos } = await sb.from('photos')
      .select('id, bucket, path, thumb_path, master_path, visibility, is_cover, sort, width, height, watermark, wm_version')
      .eq('listing_id', from).order('sort');
    for (const p of photos ?? []) {
      const id = crypto.randomUUID();
      const move = (path: string | null) => (path ? path.replace(`listings/${from}/`, `listings/${to}/`).replace(p.id, id) : null);
      const pairs: [string, string | null, string | null][] = [
        [p.bucket, p.path, move(p.path)], [p.bucket, p.thumb_path, move(p.thumb_path)], ['listing-master', p.master_path, move(p.master_path)],
      ];
      for (const [bucket, a, b] of pairs) {
        if (!a || !b) continue;
        const { error: ce } = await sb.storage.from(bucket).copy(a, b);
        if (ce) throw new Error(`Không chép được ảnh: ${ce.message}`);
      }
      const { error: pe } = await sb.from('photos').insert({
        id, listing_id: to, bucket: p.bucket, path: move(p.path), thumb_path: move(p.thumb_path), master_path: move(p.master_path),
        visibility: p.visibility, is_cover: p.is_cover, sort: p.sort, width: p.width, height: p.height, watermark: p.watermark, wm_version: p.wm_version,
      });
      if (pe) throw new Error(pe.message);
      copied++;
    }
  }
  return { photos: copied };
}
