import type { Metadata } from 'next';
import { requireStaff, staffDirectory } from '@/lib/admin/session';
import { supabaseServer } from '@/lib/supabase/server';
import { fmtDateTime } from '@/lib/admin/labels';
import { QuickReplies, type QuickReplyRow } from '@/components/admin/QuickReplies';

export const metadata: Metadata = { title: 'Trả lời nhanh' };

/** "Trả lời nhanh": RU / EN / VI message templates to copy into chats. Everyone adds and edits; hidden ones sit in "Đã ẩn". */
export default async function QuickRepliesPage() {
  await requireStaff();
  const sb = await supabaseServer();
  const [{ data }, { data: s }, dir] = await Promise.all([
    sb.from('quick_replies').select('id, code, title_vi, usage_vi, body_ru, body_en, body_vi, note_vi, sort, active, updated_by, updated_at').order('sort').order('code'),
    sb.from('settings').select('price_from_studio, price_from_1br, price_from_2br').maybeSingle(),
    staffDirectory(),
  ]);
  const rows: QuickReplyRow[] = (data ?? []).map((r) => ({
    ...r,
    edited: r.updated_by ? `${dir.get(r.updated_by)?.name ?? '—'}, ${fmtDateTime(r.updated_at)}` : null,
  }));
  return (
    <div className="a-page">
      <div className="a-head">
        <div>
          <h1 className="a-h1">Trả lời nhanh</h1>
          <div className="a-sub">Mẫu tin nhắn RU / EN / VI — chọn ngôn ngữ, bấm chép rồi dán vào Zalo / WhatsApp / Telegram. Thay các chỗ [..] trước khi gửi.</div>
        </div>
      </div>
      <QuickReplies rows={rows} prices={s ?? {}} />
    </div>
  );
}
