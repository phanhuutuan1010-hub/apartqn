import 'server-only';
import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { revalidatePublic } from '@/lib/revalidate';
import type { ListingStatusAll } from '@/lib/admin/labels';

/** info needed to refresh the public site after a change */
export async function publicRef(listingId: string) {
  const sb = await supabaseServer();
  const { data } = await sb.from('admin_listings').select('code, status, building_slug').eq('id', listingId).maybeSingle();
  return data as { code: string | null; status: ListingStatusAll; building_slug: string } | null;
}

/** Revalidate admin views of a listing, and the public pages when it has (or had) a public code. */
export async function refresh(listingId: string, wasPublic = false) {
  const ref = await publicRef(listingId);
  if (ref && (ref.code || wasPublic)) revalidatePublic({ code: ref.code, building: ref.building_slug });
  revalidatePath('/admin/can-ho');
  revalidatePath(`/admin/can-ho/${listingId}`);
}
