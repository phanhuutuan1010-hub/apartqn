/**
 * "src" tracking: any page opened with ?src=xxx stores xxx in a cookie for 30 days (proxy.ts); every contact-click log,
 * its Telegram note and every lead carry it. Readable by page JS (trackContact sends it), so not httpOnly.
 */
export const SRC_COOKIE = 'aq_src';
export const SRC_COOKIE_AGE = 30 * 86400;

/** a safe src value or null: letters, digits, _ . - (≤ 40) */
export const cleanSrc = (v: string | null | undefined) => {
  const s = (v ?? '').trim();
  return /^[A-Za-z0-9_.-]{1,40}$/.test(s) ? s : null;
};

export const srcFromCookie = (header: string | null | undefined) => {
  const m = new RegExp(`(?:^|;\s*)${SRC_COOKIE}=([^;]+)`).exec(header ?? '');
  if (!m) return null;
  try { return cleanSrc(decodeURIComponent(m[1])); } catch { return null; }
};

/** browser only */
export const readSrc = () => (typeof document === 'undefined' ? null : srcFromCookie(document.cookie));
