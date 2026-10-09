import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { GlossaryPair } from '@/lib/translate';

/** vi → en terms for "Sao chép để dịch" (staff can read; edited in Cài đặt). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadGlossary(sb: SupabaseClient<any, any, any>): Promise<GlossaryPair[]> {
  const { data } = await sb.from('translation_glossary').select('vi, en').order('sort').order('vi');
  return ((data ?? []) as { vi: string; en: string }[]).map((g) => [g.vi, g.en]);
}
