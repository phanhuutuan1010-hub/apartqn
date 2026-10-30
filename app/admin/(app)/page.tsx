import type { Metadata } from 'next';
import Link from 'next/link';
import { requireStaff } from '@/lib/admin/session';
import { supabaseServer } from '@/lib/supabase/server';
import { daysAgoIso, daysSince, fmtDateTime, missingOf, UT_LABEL } from '@/lib/admin/labels';
import { LEAD_TYPE, consignLine, type LeadType } from '@/lib/admin/leadLabels';
import styles from './dashboard.module.css';

export const metadata: Metadata = { title: 'Hôm nay' };

type NewLead = { id: string; name: string; phone: string; type: LeadType; created_at: string; payload: Record<string, string>; unit_type_code: string | null; assigned_to: string | null };
type TypeRow = { id: string; code: string; type: string; building_name: string; is_visible: boolean; price_from: number | null; area_min: number | null; photo_count: number; furniture: string | null };

/** Today's work: new leads, consign requests to hand out, unit types that still lack photos / price / area / furniture. RLS scopes the data. */
export default async function TodayPage() {
  const me = await requireStaff();
  const isAdmin = me.role === 'admin';
  const sb = await supabaseServer();
  const head = { count: 'exact' as const, head: true };

  const [{ data: settings }, leadsRes, leadCount, consignRes, consignCount, typesRes, missRes, { data: buildings }, clicksRes, chatRes] = await Promise.all([
    sb.from('settings').select('last_backup_at, backup_warn_days').maybeSingle(),
    sb.from('leads').select('id, name, phone, type, created_at, payload, unit_type_code, assigned_to').eq('status', 'new').neq('type', 'consign').order('created_at', { ascending: false }).limit(8),
    sb.from('leads').select('id', head).eq('status', 'new').neq('type', 'consign'),
    sb.from('leads').select('id, name, phone, type, created_at, payload, unit_type_code, assigned_to').eq('status', 'new').eq('type', 'consign').order('created_at', { ascending: false }).limit(6),
    sb.from('leads').select('id', head).eq('status', 'new').eq('type', 'consign'),
    sb.from('admin_unit_types').select('id, code, type, building_name, is_visible, price_from, area_min, photo_count, furniture, building_visible').eq('building_visible', true).order('building_sort').order('sort'),
    isAdmin ? sb.rpc('search_miss_top', { p_days: 30, p_limit: 8 }) : Promise.resolve({ data: null }),
    sb.from('buildings').select('id, name'),
    // consign-page contact clicks, 30 days (admins only — RLS)
    isAdmin ? sb.from('contact_clicks').select('channel').eq('page', 'ky-gui').gte('created_at', daysAgoIso(30)).limit(10000) : Promise.resolve({ data: null }),
    // "Kiểm tra căn trống" chat taps, 7 days
    sb.from('contact_intents').select('code').not('code', 'is', null).gte('created_at', daysAgoIso(7)).limit(5000),
  ]);
  const leads = (leadsRes.data ?? []) as NewLead[];
  const consign = (consignRes.data ?? []) as NewLead[];
  const types = (typesRes.data ?? []) as TypeRow[];
  // the visible buildings' types that still lack something: the shown ones first (they are live with a gap)
  const missing = types.map((t) => ({ t, miss: missingOf(t) })).filter((x) => x.miss.length).sort((a, b) => Number(b.t.is_visible) - Number(a.t.is_visible));
  const live = types.filter((t) => t.is_visible).length;
  const top = (missRes.data ?? []) as { query_norm: string; n: number }[];
  const bName = new Map((buildings ?? []).map((b) => [b.id, b.name]));
  const clicks = new Map<string, number>();
  ((clicksRes.data ?? []) as { channel: string }[]).forEach((r) => clicks.set(r.channel, (clicks.get(r.channel) ?? 0) + 1));
  const ck = (k: string) => clicks.get(k) ?? 0;
  const chats = new Map<string, number>();
  ((chatRes.data ?? []) as { code: string }[]).forEach((r) => chats.set(r.code, (chats.get(r.code) ?? 0) + 1));
  const topChats = [...chats].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const warnBackup = settings?.backup_warn_days ?? 7;
  const backupDays = daysSince(settings?.last_backup_at);
  const backupLate = backupDays == null || backupDays > warnBackup;
  const { count: notifyFailed } = isAdmin
    ? await sb.from('notifications_log').select('id', head).eq('status', 'failed').gte('created_at', daysAgoIso(7))
    : { count: 0 };
  const nothing = !leads.length && !consign.length && !missing.length;
  const leadRow = (r: NewLead) => (
    <li key={r.id}>
      <Link href={`/admin/khach-hang/${r.id}`} className="a-row">
        <span className="a-row-main"><b>{r.name}</b><span className={`a-badge ${LEAD_TYPE[r.type].tone}`}>{LEAD_TYPE[r.type].label}</span>{!r.assigned_to && <span className="a-badge warn">Chưa giao</span>}</span>
        <span className="a-row-sub">
          {r.phone} · {fmtDateTime(r.created_at)}
          {r.type === 'consign' ? ` · ${consignLine(r.payload, bName)}` : r.unit_type_code ? ` · ${r.unit_type_code}` : ''}
        </span>
      </Link>
    </li>
  );

  return (
    <div className="a-page">
      <div className="a-head">
        <div>
          <h1 className="a-h1">Hôm nay</h1>
          <div className="a-sub">Chào {me.full_name || me.email} · {isAdmin ? 'toàn hệ thống' : 'khách bạn phụ trách'} · <b>{live}</b> loại căn đang hiển thị</div>
        </div>
        <Link href="/admin/loai-can" className="a-btn a-btn-primary">Loại căn</Link>
      </div>

      {(notifyFailed ?? 0) > 0 && (
        <Link href="/admin/cai-dat" className="a-alert error" style={{ display: 'block', marginBottom: 12, textDecoration: 'none' }}>
          <b>Thông báo lỗi: {notifyFailed}</b> — có thông báo khách mới không gửi được trong 7 ngày qua. Mở Cài đặt → Kiểm tra Telegram →
        </Link>
      )}
      {isAdmin && backupLate && (
        <Link href="/admin/cai-dat" className="a-alert warn" style={{ display: 'block', marginBottom: 12, textDecoration: 'none' }}>
          Sao lưu: <b>{backupDays == null ? 'chưa có lần nào' : `${backupDays} ngày trước`}</b> — nên xuất dữ liệu (Cài đặt → Xuất dữ liệu).
        </Link>
      )}

      {nothing && <div className="a-card a-empty">Không có việc gì đang chờ. 🎉</div>}

      {leads.length > 0 && (
        <section className={styles.block} aria-labelledby="t-leads">
          <h2 id="t-leads" className={styles.h2}>
            Khách mới <span className="a-count">{leadCount.count ?? leads.length}</span>
            <Link href="/admin/khach-hang?status=new" className={styles.more}>Tất cả →</Link>
          </h2>
          <ul className="a-rows">{leads.map(leadRow)}</ul>
        </section>
      )}

      {consign.length > 0 && (
        <section className={styles.block} aria-labelledby="t-consign">
          <h2 id="t-consign" className={styles.h2}>
            Yêu cầu ký gửi <span className="a-count">{consignCount.count ?? consign.length}</span>
            <Link href="/admin/khach-hang?status=new&type=consign" className={styles.more}>Tất cả →</Link>
          </h2>
          <ul className="a-rows">{consign.map(leadRow)}</ul>
        </section>
      )}

      {missing.length > 0 && (
        <section className={styles.block} aria-labelledby="t-missing">
          <h2 id="t-missing" className={styles.h2}>
            Loại căn còn thiếu <span className="a-count">{missing.length}</span>
            <Link href="/admin/loai-can?v=missing" className={styles.more}>Tất cả →</Link>
          </h2>
          <ul className="a-rows">
            {missing.slice(0, 8).map(({ t, miss }) => (
              <li key={t.id} className={styles.dueRow}>
                <Link href={`/admin/loai-can/${t.id}`} className={styles.dueText}>
                  <b>{t.code}</b> <span className="a-muted">· {UT_LABEL[t.type]} · {t.building_name}</span>
                  <span className="a-small">Thiếu: {miss.join(', ')}{t.is_visible ? ' · đang hiển thị' : ' · đang ẩn'}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {topChats.length > 0 && (
        <p className="a-small" style={{ margin: '0 0 14px' }}>
          <b>“Kiểm tra căn trống” (7 ngày):</b> {topChats.map(([code, n], i) => <span key={code}>{i > 0 && ' · '}{code} <b>{n}</b> lượt bấm</span>)} · <Link href="/admin/khach-hang?type=wa">Xem →</Link>
        </p>
      )}

      {isAdmin && (
        <div className={`a-card ${styles.clicks}`}>
          <span>Ký gửi: <b>{ck('call') + ck('copy')}</b> gọi · <b>{ck('zalo')}</b> Zalo · <b>{ck('form')}</b> form
            {ck('callback') > 0 && <> · <b>{ck('callback')}</b> nhờ gọi lại</>}{ck('whatsapp') > 0 && <> · <b>{ck('whatsapp')}</b> WhatsApp</>}</span>
          <span className="a-muted">(30 ngày)</span>
        </div>
      )}

      {isAdmin && (
        <details className={`a-card ${styles.more2}`}>
          <summary>
            <span>Nhu cầu chưa đáp ứng</span>
            <span className={styles.sumBits}><span><b>{top.length}</b> từ khoá (30 ngày)</span></span>
          </summary>
          <div className={styles.moreBody}>
            <p className="a-small a-muted" style={{ margin: '8px 0' }}>Từ khoá khách tìm trên website mà không ra loại căn nào (ẩn danh). <Link href="/admin/nhu-cau">Xem tất cả →</Link></p>
            {top.length ? (
              <ol className={styles.demandList}>
                {top.map((r) => <li key={r.query_norm}><span className={styles.demandQ}>{r.query_norm}</span><b>{r.n}</b></li>)}
              </ol>
            ) : <p className="a-small a-muted" style={{ margin: 0 }}>Chưa có lượt tìm nào không ra kết quả.</p>}
          </div>
        </details>
      )}
    </div>
  );
}
