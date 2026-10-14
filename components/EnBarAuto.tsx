import { getLocale } from 'next-intl/server';
import { getContact, getListings } from '@/lib/repo';
import type { Building, Listing } from '@/lib/types';
import { F } from '@/lib/format';
import { minRent } from '@/lib/minRent';
import { EnBar } from './EnBar';
import { SITE_URL } from '@/data/site';
import { waHref } from '@/lib/phone';
import { bookingHref, bookingLink, bookingMessage } from '@/lib/waBooking';

type Props =
  | { kind: 'home' }
  | { kind: 'listing'; listing: Listing; /** building name, for the WhatsApp message */ building: string }
  | { kind: 'building'; building: Building };

/**
 * The phone bottom bar of an English page (nothing at all on Vietnamese pages). Prices come from the same cached public
 * listings the page already uses — no query of its own.
 *   listing  → its rent + "Book a viewing" (opens WhatsApp)          building → "From {lowest in the building}" + "See available units"
 *   home & other pages → "From {lowest on the site}" + "Browse apartments"
 *   nothing available in scope → no price, "Help me find". (Results page: ResultsView renders EnBar itself.)
 */
export async function EnBarAuto(p: Props) {
  if ((await getLocale()) !== 'en') return null;
  const [contact, listings] = await Promise.all([getContact(), getListings()]);
  if (p.kind === 'listing') {
    const href = bookingHref(contact.whatsapp ? waHref(contact.whatsapp) : null, bookingMessage({ code: p.listing.code, building: p.building, beds: p.listing.beds, rent: p.listing.rent, link: bookingLink(SITE_URL, p.listing.code) }));
    return <EnBar contact={contact} message={F.msg(p.listing.code, 'en')} price={p.listing.rent} cta="viewing" hideIds={['viewing']} book={href ? { href, code: p.listing.code } : undefined} />;
  }
  if (p.kind === 'building') {
    const price = minRent(listings.filter((x) => x.buildingId === p.building.id));
    return <EnBar contact={contact} message={F.msgB(p.building.name, 'en')} price={price} from cta="units" hideIds={['units']} />;
  }
  return <EnBar contact={contact} message={F.msgG('en')} price={minRent(listings)} from cta="browse" />;
}
