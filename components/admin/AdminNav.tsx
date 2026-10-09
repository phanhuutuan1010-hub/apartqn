'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, CalendarCheck, ExternalLink, Home, LogOut, MoreHorizontal, SearchX, Settings, UserRound, Users } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { signOut } from '@/app/admin/(auth)/actions';
import styles from './AdminNav.module.css';

const ICONS = { today: CalendarCheck, listings: Home, leads: UserRound, more: MoreHorizontal, buildings: Building2, users: Users, settings: Settings, demand: SearchX };
export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; count?: number };

/** pages reached from "Thêm" (the 4th tab) */
const MORE = ['/admin/them', '/admin/toa-nha', '/admin/nguoi-dung', '/admin/cai-dat', '/admin/tai-khoan', '/admin/nhu-cau'];

/** 4 tabs: bottom bar on phones / tablets, sidebar ≥ 1024 (where "Thêm" also lists its pages). */
export function AdminNav({ items, more, me }: { items: NavItem[]; more: NavItem[]; me: { name: string; role: string } }) {
  const path = usePathname();
  const under = (href: string) => path === href || path.startsWith(href + '/');
  const active = (href: string) =>
    href === '/admin' ? path === '/admin' : href === '/admin/them' ? MORE.some(under) : under(href);
  const link = (it: NavItem, cls: string, on: string) => {
    const Icon = ICONS[it.icon];
    return (
      <Link key={it.href} href={it.href} className={`${cls} ${active(it.href) ? on : ''}`} aria-current={active(it.href) ? 'page' : undefined}>
        <span className={styles.ico}><Icon size={20} aria-hidden />{!!it.count && <span className={styles.count}>{it.count}</span>}</span>
        <span className={styles.label}>{it.label}</span>
      </Link>
    );
  };

  return (
    <>
      <aside className={styles.side}>
        <Link href="/admin" className={styles.brand}><Logo size={22} /><span>Quản trị</span></Link>
        <nav className={styles.nav} aria-label="Quản trị">
          {items.filter((it) => it.href !== '/admin/them').map((it) => link(it, styles.item, styles.on))}
          <div className={styles.group}>Thêm</div>
          {more.map((it) => link(it, styles.item, styles.on))}
        </nav>
        <div className={styles.foot}>
          <a href="/" target="_blank" rel="noopener" className={styles.item}><span className={styles.ico}><ExternalLink size={18} aria-hidden /></span><span className={styles.label}>Xem website</span></a>
          <Link href="/admin/tai-khoan" className={`${styles.me} ${active('/admin/tai-khoan') ? styles.on : ''}`} title="Tài khoản của tôi">
            <span className={styles.meName}>{me.name}</span>
            <span className={styles.meRole}>{me.role} · Tài khoản</span>
          </Link>
          <form action={signOut}>
            <button className={styles.item} style={{ width: '100%' }}><span className={styles.ico}><LogOut size={18} aria-hidden /></span><span className={styles.label}>Đăng xuất</span></button>
          </form>
        </div>
      </aside>
      <nav className={styles.bar} aria-label="Quản trị">
        {items.map((it) => link(it, styles.tab, styles.tabOn))}
      </nav>
    </>
  );
}
