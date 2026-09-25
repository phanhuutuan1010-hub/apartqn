'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, ClipboardCheck, Home, Inbox, LayoutDashboard, LogOut, Menu, Settings, Users, UserRound, X, ExternalLink } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { signOut } from '@/app/admin/(auth)/actions';
import styles from './AdminNav.module.css';

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; count?: number };

const ICONS = { dashboard: LayoutDashboard, listings: Home, approve: ClipboardCheck, inbox: Inbox, leads: UserRound, buildings: Building2, users: Users, settings: Settings };

export function AdminNav({ items, me }: { items: NavItem[]; me: { name: string; role: string } }) {
  const path = usePathname();
  // the drawer belongs to the page it was opened on → closes itself on navigation
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === path;
  const setOpen = (v: boolean | ((o: boolean) => boolean)) => setOpenAt((typeof v === 'function' ? v(open) : v) ? path : null);
  const active = (href: string) => (href === '/admin' ? path === '/admin' : path === href || path.startsWith(href + '/'));

  return (
    <>
      <div className={styles.topbar}>
        <button type="button" className={styles.burger} aria-label="Menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
        <Link href="/admin" className={styles.brand}><Logo size={20} /><span>Quản trị</span></Link>
      </div>
      <aside className={`${styles.side} ${open ? styles.open : ''}`}>
        <Link href="/admin" className={`${styles.brand} ${styles.brandSide}`}><Logo size={22} /><span>Quản trị</span></Link>
        <nav className={styles.nav}>
          {items.map((it) => {
            const Icon = ICONS[it.icon];
            return (
              <Link key={it.href} href={it.href} className={`${styles.item} ${active(it.href) ? styles.on : ''}`} aria-current={active(it.href) ? 'page' : undefined}>
                <Icon size={18} aria-hidden />
                <span className={styles.label}>{it.label}</span>
                {!!it.count && <span className={styles.count}>{it.count}</span>}
              </Link>
            );
          })}
        </nav>
        <div className={styles.foot}>
          <a href="/" target="_blank" rel="noopener" className={styles.item}><ExternalLink size={18} aria-hidden /><span className={styles.label}>Xem website</span></a>
          <div className={styles.me}>
            <span className={styles.meName}>{me.name}</span>
            <span className={styles.meRole}>{me.role}</span>
          </div>
          <form action={signOut}>
            <button className={styles.item} style={{ width: '100%' }}><LogOut size={18} aria-hidden /><span className={styles.label}>Đăng xuất</span></button>
          </form>
        </div>
      </aside>
      {open && <div className={styles.scrim} onClick={() => setOpen(false)} aria-hidden />}
    </>
  );
}
