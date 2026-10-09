import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requireStaff, staffDirectory } from '@/lib/admin/session';
import { supabaseServer, SUPABASE_URL } from '@/lib/supabase/server';
import { publicPhotoUrl } from '@/lib/repoMap';
import { STATUS_LABEL, STATUS_TONE, daysAgoIso, daysSince, fmtDateTime, fmtVnd, furnLabel, type ListingStatusAll } from '@/lib/admin/labels';
import { LEAD_TYPE, consignLine, type LeadType } from '@/lib/admin/leadLabels';
import { ApprovalActions } from '@/components/admin/ApprovalActions';
import { QuickConfirm } from '@/components/admin/QuickConfirm';
import styles from './dashboard.module.css';

export const metadata: Metadata = { title: 'Hôm nay' };

type Pending = {
  id: string; rent: number; area: number; beds: number; furn: string; move_in: string; submitted_at: string | null;
  units: { floor: number; unit_no: string; assigned_to: string | null; buildings: { name: string } };
  photos: { path: string; thumb_path: string | null; visibility: string; is_cover: boolean; sort: number }[];
};
type Due = { id: string; code: string | null; building_name: string; floor: number; unit_no: string; verified_at: string | null };
type NewLead = { id: string; name: string; phone: string; type: LeadType; created_at: string; payload: Record<string, string>; listings: { code: string | null } | null };

/** Today's work first (approve, confirm, call back); everything else folds into one summary row. RLS scopes the data. */
export default async function TodayPage() {
  const me = await requireStaff();
  const isAdmin = me.role === 'admin';
  const sb = await supabaseServer();
  const { data: settings } = await sb.from('settings').select('*').maybeSingle();
  const remind = settings?.verify_remind_days ?? 14;
  const warnBackup = settings?.backup_warn_days ?? 7;
  const head = { count: 'exact' as const, head: true };

  const [pendingRes, dueRes, dueCount, leadsRes, leadCount, trEn, all, missRes, dir, { data: buildings }] = await Promise.all([
    isAdmin
      ? sb.from('listings')
          .select('id, rent, area, beds, furn, move_in, submitted_at, units(floor, unit_no, assigned_to, buildings(name)), photos(path, thumb_path, visibility, is_cover, sort)')
          .eq('status', 'pending').order('submitted_at', { ascending: true }).limit(10)
      : Promise.resolve({ data: [] }),
    sb.from('admin_listings').select('id, code, building_name, floor, unit_no, verified_at')
      .in('status', ['available', 'reserved']).lt('verified_at', daysAgoIso(remind)).order('verified_at', { ascending: true }).limit(6),
    sb.from('admin_listings').select('id', head).in('status', ['available', 'reserved']).lt('verified_at', daysAgoIso(remind)),
    sb.from('leads').select('id, name, phone, type, created_at, payload, listings(code)').eq('status', 'new').order('created_at', { ascending: false }).limit(6),
    sb.from('leads').select('id', head).eq('status', 'new'),
    sb.from('admin_listings').select('id', head).in('status', ['available', 'reserved', 'rented']).or('has_en.eq.false,en_outdated.eq.true'),
    sb.from('admin_listings').select('status'),
    // unmet demand: searches that found nothing (admins only — RLS returns nothing to sales)
    isAdmin ? sb.rpc('search_miss_top', { p_days: 30, p_limit: 8 }) : Promise.resolve({ data: null }),
    staffDirectory(),
    sb.from('buildings').select('id, name'),
  ]);
  const pending = (pendingRes.data ?? []) as unknown as Pending[];
  const due = (dueRes.data ?? []) as Due[];
  const leads = (leadsRes.data ?? []) as unknown as NewLead[];
  const top = (missRes.data ?? []) as { query_norm: string; n: number }[];
  const byStatus = new Map<ListingStatusAll, number>();
  (all.data ?? []).forEach((r) => byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1));
  const backupDays = daysSince(settings?.last_backup_at);
  const backupLate = backupDays == null || backupDays > warnBackup;
  const bName = new Map((buildings ?? []).map((b) => [b.id, b.name]));
  const nothing = !pending.length && !due.length && !leads.length;

  return (
    <div className="a-page">
      <div className="a-head">
        <div>
          <h1 className="a-h1">Hôm nay</h1>
          <div className="a-sub">Chào {me.full_name || me.email} · {isAdmin ? 'toàn hệ thống' : 'các căn và khách bạn phụ trách'}</div>
        </div>
        <Link href="/admin/can-ho/moi" className="a-btn a-btn-primary"><Plus size={16} aria-hidden /> Thêm căn</Link>
      </div>

      {nothing && <div className="a-card a-empty">Không có việc gì đang chờ. 🎉</div>}

      {pending.length > 0 && (
        <section className={styles.block} aria-labelledby="t-pending">
          <h2 id="t-pending" className={styles.h2}>Chờ duyệt <span className="a-count">{pending.length}</span></h2>
          {pending.map((r) => {
            const pub = r.photos.filter((p) => p.visibility === 'public').sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort - b.sort);
            return (
              <div key={r.id} className={`a-card ${styles.pending}`}>
                <div style={{ minWidth: 0 }}>
                  <Link href={`/admin/can-ho/${r.id}`} className={styles.title}>{r.units.buildings.name} · T{r.units.floor} · {r.units.unit_no}</Link>
                  <div className="a-small a-muted">gửi bởi <b>{r.units.assigned_to ? dir.get(r.units.assigned_to)?.name : '—'}</b> · {fmtDateTime(r.submitted_at)}</div>
                  <div className={styles.facts}>
                    <b style={{ color: 'var(--red-500)' }}>{fmtVnd(r.rent)} ₫</b> · {r.area} m² · {r.beds === 0 ? 'Studio' : `${r.beds} PN`} · {furnLabel(r.furn)} · dọn vào {r.move_in}
                  </div>
                  <div className={styles.thumbs}>
                    {pub.slice(0, 4).map((p) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={p.path} src={publicPhotoUrl(SUPABASE_URL, p.thumb_path ?? p.path)} alt="" loading="lazy" />
                    ))}
                    {!pub.length && <span className="a-badge red">Chưa có ảnh công khai</span>}
                  </div>
                </div>
                <ApprovalActions id={r.id} />
              </div>
            );
          })}
        </section>
      )}

      {due.length > 0 && (
        <section className={styles.block} aria-labelledby="t-due">
          <h2 id="t-due" className={styles.h2}>
            Cần xác nhận còn trống <span className="a-count">{dueCount.count ?? due.length}</span>
            <Link href="/admin/can-ho?v=due" className={styles.more}>Tất cả →</Link>
          </h2>
          <ul className="a-rows">
            {due.map((r) => (
              <li key={r.id} className={styles.dueRow}>
                <Link href={`/admin/can-ho/${r.id}`} className={styles.dueText}>
                  <b>{r.code ?? '—'}</b> <span className="a-muted">· {r.building_name} · T{r.floor} · {r.unit_no}</span>
                  <span className="a-small a-muted">{daysSince(r.verified_at)} ngày chưa xác nhận</span>
                </Link>
                <QuickConfirm id={r.id} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {leads.length > 0 && (
        <section className={styles.block} aria-labelledby="t-leads">
          <h2 id="t-leads" className={styles.h2}>
            Khách mới <span className="a-count">{leadCount.count ?? leads.length}</span>
            <Link href="/admin/khach-hang?status=new" className={styles.more}>Tất cả →</Link>
          </h2>
          <ul className="a-rows">
            {leads.map((r) => (
              <li key={r.id}>
                <Link href={`/admin/khach-hang/${r.id}`} className="a-row">
                  <span className="a-row-main"><b>{r.name}</b><span className={`a-badge ${LEAD_TYPE[r.type].tone}`}>{LEAD_TYPE[r.type].label}</span></span>
                  <span className="a-row-sub">
                    {r.phone} · {fmtDateTime(r.created_at)}
                    {r.type === 'consign' ? ` · ${consignLine(r.payload, bName)}` : r.listings?.code ? ` · ${r.listings.code}` : ''}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* secondary: one expandable summary row */}
      <details className={`a-card ${styles.more2}`}>
        <summary>
          <span>Khác</span>
          <span className={styles.sumBits}>
            {isAdmin && <span>Nhu cầu chưa đáp ứng <b>{top.length}</b></span>}
            <span>Cần dịch EN <b className={trEn.count ? styles.warnTxt : undefined}>{trEn.count ?? 0}</b></span>
            {isAdmin && <span>Sao lưu <b className={backupLate ? styles.redTxt : undefined}>{backupDays == null ? 'chưa có' : backupDays === 0 ? 'hôm nay' : `${backupDays} ngày`}</b></span>}
          </span>
        </summary>
        <div className={styles.moreBody}>
          {isAdmin && (
            <div>
              <h3 className={styles.h3}>Nhu cầu chưa đáp ứng <Link href="/admin/nhu-cau" className={styles.more}>Xem tất cả →</Link></h3>
              <p className="a-small a-muted" style={{ margin: '0 0 8px' }}>Từ khoá khách tìm trên website trong 30 ngày qua mà không ra căn nào (ẩn danh).</p>
              {top.length ? (
                <ol className={styles.demandList}>
                  {top.map((r) => <li key={r.query_norm}><span className={styles.demandQ}>{r.query_norm}</span><b>{r.n}</b></li>)}
                </ol>
              ) : <p className="a-small a-muted" style={{ margin: 0 }}>Chưa có lượt tìm nào không ra kết quả.</p>}
            </div>
          )}
          <div>
            <h3 className={styles.h3}>Cần dịch EN</h3>
            <p className="a-small" style={{ margin: 0 }}><Link href="/admin/can-ho?tr=en">{trEn.count ?? 0} tin đang đăng thiếu / cũ bản tiếng Anh →</Link></p>
          </div>
          {isAdmin && (
            <div>
              <h3 className={styles.h3}>Sao lưu</h3>
              <p className="a-small" style={{ margin: 0 }}>
                {backupLate ? `Nên xuất dữ liệu (> ${warnBackup} ngày). ` : 'Ổn. '}<Link href="/admin/cai-dat">Cài đặt → Xuất dữ liệu</Link>
              </p>
            </div>
          )}
          <div>
            <h3 className={styles.h3}>Căn hộ theo trạng thái</h3>
            <div className={styles.status}>
              {(Object.keys(STATUS_LABEL) as ListingStatusAll[]).map((s) => (
                <Link key={s} href={`/admin/can-ho?status=${s}`} className={styles.statusItem}>
                  <span className={`a-badge dot ${STATUS_TONE[s]}`}>{STATUS_LABEL[s]}</span>
                  <b>{byStatus.get(s) ?? 0}</b>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}
