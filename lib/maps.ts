/**
 * Google Maps links → coordinates. Only coordinates written in the link itself are used — never geocoded or guessed.
 * Order: the place pin (!3d…!4d…), an explicit point (q= / ll= / query= / /place/lat,lng), then the map centre (@lat,lng)
 * only when zoomed in (≥ 15z).
 */
const GOOGLE_HOST = /^(?:www\.|maps\.)?google\.(?:com|com\.vn)$/;
const SHORT_HOST = /^(?:maps\.app\.goo\.gl|goo\.gl)$/;

export function isMapsHost(host: string) {
  return GOOGLE_HOST.test(host) || SHORT_HOST.test(host);
}

/** A pasted link the admin may save: https, Google Maps host (short or full). */
export function mapsUrlOk(raw: string) {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' || !isMapsHost(u.hostname)) return false;
    return SHORT_HOST.test(u.hostname) || u.pathname.startsWith('/maps') || u.hostname.startsWith('maps.');
  } catch {
    return false;
  }
}

const valid = (lat: number, lng: number) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
const pair = (a: string, b: string) => {
  const lat = Number(a), lng = Number(b);
  return valid(lat, lng) ? { lat, lng } : null;
};
const NUM = '(-?\\d{1,3}\\.\\d{3,})';

export function coordsFromMapsUrl(url: string): { lat: number; lng: number } | null {
  let s = url;
  try { s = decodeURIComponent(url); } catch { /* keep raw */ }
  const pin = [...s.matchAll(new RegExp(`!3d${NUM}!4d${NUM}`, 'g'))].pop();
  if (pin) return pair(pin[1], pin[2]);
  const point = s.match(new RegExp(`[?&](?:q|ll|query|destination)=${NUM},\\s*${NUM}`)) ?? s.match(new RegExp(`/(?:place|search|dir)/${NUM},\\s*${NUM}`));
  if (point) return pair(point[1], point[2]);
  const at = s.match(new RegExp(`@${NUM},${NUM},(\\d+(?:\\.\\d+)?)z`));
  if (at && Number(at[3]) >= 15) return pair(at[1], at[2]);
  return null;
}

/** What the map shows: verified coordinates, else the building's name + address (Google finds it — shown as approximate). */
export type MapTarget = { lat?: number; lng?: number; name: string; street?: string };
const mapQuery = (t: MapTarget) => {
  if (t.lat != null && t.lng != null) return `${t.lat},${t.lng}`;
  const parts = [t.name, t.street].filter(Boolean) as string[];
  // add the city unless the name / address already says it
  if (!parts.some((p) => /quy\s*nh[oơ]n/i.test(p))) parts.push('Quy Nhơn');
  return parts.join(', ');
};
export const hasCoords = (t: MapTarget) => t.lat != null && t.lng != null;
/** keyless Google Maps embed */
export const mapsEmbedUrl = (t: MapTarget, locale: string) =>
  `https://www.google.com/maps?q=${encodeURIComponent(mapQuery(t))}&z=16&hl=${locale}&output=embed`;
/** opens the Google Maps app / site (Maps URLs API) */
export const mapsOpenUrl = (t: MapTarget) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery(t))}`;
