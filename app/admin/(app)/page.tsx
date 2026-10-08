import type { Metadata } from 'next';
import Link from 'next/link';
import { ClipboardCheck, CalendarClock, Languages, UserRound, Inbox, DatabaseBackup, Plus, SearchX } from 'lucide-react';
import { requireStaff } from '@/lib/admin/session';
import { supabaseServer } from '@/lib/supabase/server';
import { STATUS_LABEL, STATUS_TONE, daysAgoIso, daysSince, type ListingStatusAll } from '@/lib/admin/labels';
import styles from './dashboard.module.css';

export const metadata: Metadata = { title: 'Tổng quan' };

type Tile = { href: string; label: string; value: number | string; hint: string; icon: React.ReactNode; tone?: 'red' | 'warn' | 'ok' };

/** Counts go through RLS: sales see their own work, admins see everything. */
export default async function DashboardPage() {
  const me = await requireStaff();
  const isAdmin = me.role === 'admin';
  const sb = await supabaseServer();
  const { data: settings } = await sb.from('settings').select('*').maybeSingle();
  const remind = settings?.verify_remind_days ?? 14;
  const warnBackup = settings?.backup_warn_days ?? 7;

  const head = { count: 'exact' as const, head: true };
  const [pending, due, trEn, trRu, leadsNew, consignNew, all] = await Promise.all([
    sb.from('admin_listings').select('id', head).eq('status', 'pending'),
    sb.from('admin_listings').select('id', head).in('status', ['available', 'reserved']).lt('verified_at', daysAgoIso(remind)),
    sb.from('admin_listings').select('id', head).in('status', ['available', 'reserved', 'rented']).or('has_en.eq.false,en_outdated.eq.true'),
    sb.from('admin_listings').select('id', head).in('status', ['available', 'reserved', 'rented']).or('has_ru.eq.false,ru_outdated.eq.true'),
    sb.from('leads').select('id', head).eq('status', 'new'),
    isAdmin ? sb.from('consign_inbox').select('id', head).eq('status', 'new') : Promise.resolve({ count: 0 }),
    sb.from('admin_listings').select('status'),
  ]);
  // unmet demand: searches that found nothing (admins only — RLS returns nothing to sales)
  const { data: misses } = isAdmin ? await sb.rpc('search_miss_top', { p_days: 30, p_limit: 8 }) : { data: null };
  const top = (misses ?? []) as { query_norm: string; n: number }[];
  const byStatus = new Map<ListingStatusAll, number>();
  (all.data ?? []).forEach((r) => byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1));
  const backupDays = daysSince(settings?.last_backup_at);

  const tiles: Tile[] = [
    ...(isAdmin ? [{ href: '/admin/duyet-tin', label: 'Chờ duyệt', value: pending.count ?? 0, hint: 'tin sales gửi lên', icon: <ClipboardCheck size={18} />, tone: (pending.count ? 'warn' : undefined) as Tile['tone'] }] : []),
    { href: '/admin/can-ho?v=due', label: 'Cần xác nhận còn trống', value: due.count ?? 0, hint: `quá ${remind} ngày chưa xác nhận`, icon: <CalendarClock size={18} />, tone: due.count ? 'warn' : undefined },
    { href: '/admin/can-ho?tr=en', label: 'Cần dịch', value: `EN ${trEn.count ?? 0} · RU ${trRu.count ?? 0}`, hint: 'tin đang đăng thiếu / cũ bản dịch', icon: <Languages size={18} />, tone: (trEn.count || trRu.count) ? 'warn' : undefined },
    { href: '/admin/khach-hang?status=new', label: 'Lead mới', value: leadsNew.count ?? 0, hint: 'chưa liên hệ', icon: <UserRound size={18} />, tone: leadsNew.count ? 'warn' : undefined },
    ...(isAdmin ? [{ href: '/admin/cho-xu-ly', label: 'Ký gửi mới', value: consignNew.count ?? 0, hint: 'chờ giao cho sales', icon: <Inbox size={18} />, tone: (consignNew.count ? 'warn' : undefined) as Tile['tone'] }] : []),
    ...(isAdmin ? [{
      href: '/admin/cai-dat', label: 'Sao lưu gần nhất',
      value: backupDays == null ? 'Chưa có' : backupDays === 0 ? 'Hôm nay' : `${backupDays} ngày`,
      hint: backupDays == null || backupDays > warnBackup ? `nên xuất dữ liệu (> ${warnBackup} ngày)` : 'ổn',
      icon: <DatabaseBackup size={18} />, tone: (backupDays == null || backupDays > warnBackup ? 'red' : 'ok') as Tile['tone'],
    }] : []),
  ];

  return (
    <div className="a-page">
      <div className="a-head">
        <div>
          <h1 className="a-h1">Chào {me.full_name || me.email}</h1>
          <div className="a-sub">{isAdmin ? 'Toàn bộ hệ thống' : 'Các căn và khách bạn phụ trách'}</div>
        </div>
        <Link href="/admin/can-ho/moi" className="a-btn a-btn-primary"><Plus size={16} aria-hidden /> Thêm căn</Link>
      </div>

      <div className={styles.tiles}>
        {tiles.map((t) => (
          <Link key={t.label} href={t.href} className={`${styles.tile} ${t.tone ? styles[t.tone] : ''}`}>
            <span className={styles.label}>{t.icon}{t.label}</span>
            <span className={styles.value}>{t.value}</span>
            <span className={styles.hint}>{t.hint}</span>
          </Link>
        ))}
      </div>

      {isAdmin && (
        <section className={`a-card ${styles.demand}`} aria-labelledby="demand-title">
          <div className={styles.demandHead}>
            <h2 id="demand-title" className="a-section-title" style={{ margin: 0 }}><SearchX size={18} aria-hidden /> Nhu cầu chưa đáp ứng</h2>
            <Link href="/admin/nhu-cau" className="a-small" style={{ color: 'var(--blue-500)' }}>Xem tất cả →</Link>
          </div>
          <p className="a-small a-muted" style={{ margin: '4px 0 10px' }}>Từ khoá khách tìm trên website trong 30 ngày qua mà không ra căn nào (ẩn danh).</p>
          {top.length ? (
            <ol className={styles.demandList}>
              {top.map((r) => (
                <li key={r.query_norm}><span className={styles.demandQ}>{r.query_norm}</span><b>{r.n}</b></li>
              ))}
            </ol>
          ) : <p className="a-small a-muted" style={{ margin: 0 }}>Chưa có lượt tìm nào không ra kết quả.</p>}
        </section>
      )}

      <h2 className="a-section-title" style={{ marginTop: 28 }}>Căn hộ theo trạng thái</h2>
      <div className={styles.status}>
        {(Object.keys(STATUS_LABEL) as ListingStatusAll[]).map((s) => (
          <Link key={s} href={`/admin/can-ho?status=${s}`} className={styles.statusItem}>
            <span className={`a-badge dot ${STATUS_TONE[s]}`}>{STATUS_LABEL[s]}</span>
            <b>{byStatus.get(s) ?? 0}</b>
          </Link>
        ))}
      </div>
    </div>
  );
}
