'use client';

import { useEffect, useRef, useState } from 'react';
import type { ComponentProps } from 'react';
import { Link } from '@/i18n/navigation';
import type { Contact } from '@/lib/contacts';
import { Logo } from './Logo';
import styles from './MobileMenu.module.css';

type Href = ComponentProps<typeof Link>['href'];

type Props = {
  active: string;
  nav: { k: string; label: string; href: Href }[];
  contacts: Contact[];
  labels: { menu: string; close: string; contact: string; hours: string; consign: string };
};

/** Hamburger (<1024) → full-screen drawer: nav rows, outlined consign, 2 locale contacts, hours. */
export function MobileMenu({ active, nav, contacts, labels }: Props) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const opener = openRef.current;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onResize = () => { if (window.innerWidth >= 1024) setOpen(false); };
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      opener?.focus();
    };
  }, [open]);

  const close = () => setOpen(false);
  const rows = nav.filter((n) => n.k !== 'consign');

  return (
    <>
      <button ref={openRef} type="button" className={styles.burger} aria-label={labels.menu} aria-expanded={open} onClick={() => setOpen(true)}>
        <span /><span /><span />
      </button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label={labels.menu} className={styles.drawer}>
          <div className={styles.top}>
            <Logo size={22} />
            <button ref={closeRef} type="button" className={styles.close} aria-label={labels.close} onClick={close}>×</button>
          </div>
          <nav className={styles.nav}>
            {rows.map((n) => (
              <Link key={n.k} href={n.href} onClick={close} className={`${styles.row} ${n.k === active ? styles.rowActive : ''}`}>{n.label}</Link>
            ))}
          </nav>
          <div className={styles.bottom}>
            <Link href="/ky-gui" onClick={close} className={`btn btn-secondary ${styles.consign}`}>{labels.consign}</Link>
            <span className={`eyebrow ${styles.contactLabel}`}>{labels.contact}</span>
            <div className={styles.contacts}>
              {contacts.map((c, i) => (
                <a key={c.k} href={c.href} {...(c.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})} className={`btn ${i === 0 ? 'btn-blue' : 'btn-secondary'} ${styles.contact}`}>{c.label}</a>
              ))}
            </div>
            <span className={styles.hours}>{labels.hours}</span>
          </div>
        </div>
      )}
    </>
  );
}
