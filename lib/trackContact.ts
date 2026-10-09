'use client';
/** Anonymous contact-click count (rpc log_contact_click): channel + page + site language only — no user data. */
export type ContactChannel = 'call' | 'zalo' | 'whatsapp' | 'copy' | 'form' | 'callback';

export function trackContact(channel: ContactChannel, locale: string, page = 'ky-gui') {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return;
  void fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/log_contact_click`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
    body: JSON.stringify({ p_channel: channel, p_page: page, p_locale: locale }),
    keepalive: true,
  }).catch(() => {});
}
