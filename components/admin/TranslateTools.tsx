'use client';

import { useEffect, useRef, useState } from 'react';
import { ClipboardCopy, ClipboardPaste } from 'lucide-react';
import { cleanPasted, copyBlock, mismatchText, type GlossaryPair } from '@/lib/translate';

/** EN tab helpers: "Sao chép để dịch" (instruction + glossary + VI), "Dán bản dịch", live VI ↔ EN number check. */
export default function TranslateTools({ vi, en, glossary, onPaste }: { vi: string; en: string; glossary: GlossaryPair[]; onPaste: (t: string) => void }) {
  const [msg, setMsg] = useState<{ ok: boolean; m: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const say = (ok: boolean, m: string) => { setMsg({ ok, m }); clearTimeout(timer.current); timer.current = setTimeout(() => setMsg(null), 4000); };
  const warn = mismatchText(vi, en);
  // pasting a chat answer by hand into an empty EN field: drop "English:", quotes and code fences
  useEffect(() => {
    const el = document.querySelector<HTMLTextAreaElement>('textarea[name="desc_en"]');
    if (!el) return;
    const onPasteEvt = (e: ClipboardEvent) => {
      const raw = e.clipboardData?.getData('text') ?? '';
      const clean = cleanPasted(raw);
      if (clean && clean !== raw.trim() && !el.value.trim()) { e.preventDefault(); onPaste(clean); }
    };
    el.addEventListener('paste', onPasteEvt);
    return () => el.removeEventListener('paste', onPasteEvt);
  }, [onPaste]);

  const copy = async () => {
    if (!vi.trim()) return say(false, 'Chưa có mô tả tiếng Việt để dịch.');
    try {
      await navigator.clipboard.writeText(copyBlock(vi, glossary));
      say(true, 'Đã sao chép – dán vào Claude');
    } catch {
      say(false, 'Trình duyệt không cho sao chép tự động.');
    }
  };
  const paste = async () => {
    try {
      const t = cleanPasted(await navigator.clipboard.readText());
      if (!t) return say(false, 'Clipboard đang trống.');
      onPaste(t);
      say(true, 'Đã dán bản dịch — kiểm tra rồi bấm Lưu.');
    } catch {
      // no clipboard-read permission (Firefox, some phones): paste by hand into the field — it is cleaned on paste
      document.querySelector<HTMLTextAreaElement>('textarea[name="desc_en"]')?.focus();
      say(false, 'Trình duyệt chặn đọc clipboard — dán thủ công vào ô (Ctrl+V, hoặc giữ ngón tay → Dán).');
    }
  };

  return (
    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="a-btn a-btn-outline" onClick={copy}><ClipboardCopy size={16} aria-hidden /> Sao chép để dịch</button>
        <button type="button" className="a-btn a-btn-outline" onClick={paste}><ClipboardPaste size={16} aria-hidden /> Dán bản dịch</button>
      </div>
      {msg && <span className="a-small" role="status" style={{ color: msg.ok ? 'var(--ok-fg)' : 'var(--warn-fg)' }}>{msg.m}</span>}
      {warn && <div className="a-alert warn" role="status">{warn}</div>}
    </div>
  );
}
