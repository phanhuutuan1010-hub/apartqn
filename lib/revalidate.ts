import 'server-only';
import { revalidatePath } from 'next/cache';
import { LOCALES } from '@/i18n/routing';

/**
 * Refresh the public pages that show a listing / building (all locales), plus results, home and sitemap.
 * Internal route paths always carry the locale segment (/vi/…), even though vi URLs are unprefixed.
 */
export function revalidatePublic({ code, building }: { code?: string | null; building?: string | null }) {
  for (const l of LOCALES) {
    revalidatePath(`/${l}`);
    revalidatePath(`/${l}/can-ho`);
    if (code) revalidatePath(`/${l}/can-ho/${code.toLowerCase()}`);
    if (building) revalidatePath(`/${l}/toa-nha/${building}`);
  }
  revalidatePath('/sitemap.xml');
}
