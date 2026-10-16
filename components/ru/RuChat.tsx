'use client';

import type { ReactNode } from 'react';

/**
 * A plain link to Telegram / WhatsApp on the Russian landing page (opens at once, like any link). The tap is reported to
 * /api/intent with sendBeacon — origin 'ru-page'; the ?src cookie and the first-touch post are added on the server.
 * Fire-and-forget: nothing waits for it, no personal data is sent.
 */
export function RuChat({ href, channel, className, children }: { href: string; channel: 'telegram' | 'whatsapp'; className?: string; children: ReactNode }) {
  const report = () => {
    try {
      const body = JSON.stringify({ kind: 'contact', channel, origin: 'ru-page', page: '/ru', locale: 'ru' });
      if (!navigator.sendBeacon?.('/api/intent', new Blob([body], { type: 'text/plain' }))) {
        void fetch('/api/intent', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(() => {});
      }
    } catch { /* logging never gets in the way */ }
  };
  return <a href={href} target="_blank" rel="noopener noreferrer" className={className} onClick={report}>{children}</a>;
}
