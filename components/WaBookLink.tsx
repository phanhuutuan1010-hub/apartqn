'use client';

import type { ReactNode } from 'react';

/**
 * A plain link to WhatsApp (opens at once, like any link). The tap is also reported to /api/intent with sendBeacon —
 * fire-and-forget: nothing waits for it and a failure changes nothing for the visitor. No personal data is sent.
 */
export function WaBookLink({ href, code, className, tabIndex, children }: { href: string; code: string; className?: string; tabIndex?: number; children: ReactNode }) {
  const report = () => {
    try {
      const body = JSON.stringify({ code, channel: 'whatsapp', page: location.pathname, locale: document.documentElement.lang });
      if (!navigator.sendBeacon?.('/api/intent', new Blob([body], { type: 'text/plain' }))) {
        void fetch('/api/intent', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(() => {});
      }
    } catch { /* logging never gets in the way */ }
  };
  return <a href={href} target="_blank" rel="noopener noreferrer" className={className} tabIndex={tabIndex} onClick={report}>{children}</a>;
}
