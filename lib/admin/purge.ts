import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export type StorageObject = { bucket: string; path: string };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = SupabaseClient<any, any, any>;

const DAY = 86_400_000;
export const TRASH_DAYS = 30;

/** Remove storage files returned by the purge rpcs, per bucket, 100 at a time. Returns how many could not be removed. */
export async function removeObjects(sb: Sb, objects: StorageObject[] | null | undefined): Promise<number> {
  const byBucket = new Map<string, string[]>();
  for (const o of objects ?? []) if (o?.bucket && o.path) byBucket.set(o.bucket, [...new Set([...(byBucket.get(o.bucket) ?? []), o.path])]);
  let failed = 0;
  for (const [bucket, paths] of byBucket) {
    for (let i = 0; i < paths.length; i += 100) {
      const chunk = paths.slice(i, i + 100);
      const { error } = await sb.storage.from(bucket).remove(chunk);
      if (error) { console.error('[purge] storage', bucket, error.message); failed += chunk.length; }
    }
  }
  return failed;
}

/** Daily cron (service role): hard-delete everything trashed more than 30 days ago, then its files. */
export async function purgeExpired(sb: Sb) {
  const before = new Date(Date.now() - TRASH_DAYS * DAY).toISOString();
  const out = { listings: 0, leads: 0, buildings: 0, filesFailed: 0, errors: [] as string[] };
  const run = async (table: 'listings' | 'leads' | 'buildings', rpc: string, arg: string) => {
    const { data } = await sb.from(table).select('id').lt('deleted_at', before).limit(200);
    for (const r of (data ?? []) as { id: string }[]) {
      const { data: files, error } = await sb.rpc(rpc, { [arg]: r.id });
      if (error) { out.errors.push(`${table} ${r.id}: ${error.message}`); continue; }
      out[table]++;
      out.filesFailed += await removeObjects(sb, files as StorageObject[]);
    }
  };
  // listings first: a trashed building can only be purged once nothing points at it
  await run('listings', 'purge_listing', 'p_listing');
  await run('leads', 'purge_lead', 'p_lead');
  await run('buildings', 'purge_building', 'p_building');
  return out;
}
