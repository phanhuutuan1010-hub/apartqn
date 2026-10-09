'use client';

import { useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { EN_STATUS_LABEL, normVi, type EnStatus, type GlossaryPair } from '@/lib/translateCore';

// copy / paste / number check: loaded the first time the EN tab is opened
const TranslateTools = dynamic(() => import('./TranslateTools'), { ssr: false });

/**
 * VI | EN description editor (listing / building). Status per field: Chưa dịch · Đã dịch · Cần cập nhật — "Đã dịch" means
 * the saved English was written from the current Vietnamese (source hash, checked on the server). Plain textareas named desc_vi / desc_en, so the
 * surrounding form (and its draft autosave) works unchanged.
 */
export function DescEditor({ vi, en, status, glossary, startTab = 'vi', errors = {}, note }: {
  vi: string; en: string; status: EnStatus; glossary: GlossaryPair[];
  startTab?: 'vi' | 'en'; errors?: { vi?: string; en?: string }; note?: React.ReactNode;
}) {
  const [tab, setTab] = useState<'vi' | 'en'>(startTab);
  const [toolsOn, setToolsOn] = useState(startTab === 'en');
  const [viText, setViText] = useState(vi);
  const [enText, setEnText] = useState(en);
  const viRef = useRef<HTMLTextAreaElement>(null);
  const enRef = useRef<HTMLTextAreaElement>(null);

  // live status while typing: edited EN will be "Đã dịch" once saved; an edited VI makes a translated EN outdated
  const live: EnStatus = !normVi(viText) ? 'na' : !enText.trim() ? 'none' : enText !== en ? 'ok'
    : status === 'ok' && normVi(viText) !== normVi(vi) ? 'stale' : status === 'na' || status === 'none' ? 'stale' : status;
  const pick = (k: 'vi' | 'en') => { setTab(k); if (k === 'en') setToolsOn(true); };
  const badge = live === 'na' ? null : <span className={`a-badge ${EN_STATUS_LABEL[live].tone}`}>{EN_STATUS_LABEL[live].label}</span>;
  /** set the EN text from code (paste button) and let the form notice the change */
  const setEn = (t: string) => {
    const el = enRef.current;
    if (!el) return;
    el.value = t;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    setEnText(t);
    el.focus();
  };

  return (
    <div className="a-desc">
      <div className="a-seg" role="tablist" aria-label="Ngôn ngữ mô tả">
        <button type="button" role="tab" aria-selected={tab === 'vi'} className={tab === 'vi' ? 'on' : undefined} onClick={() => pick('vi')}>VI</button>
        <button type="button" role="tab" aria-selected={tab === 'en'} className={tab === 'en' ? 'on' : undefined} onClick={() => pick('en')}>EN {badge}</button>
      </div>
      <label className={`a-field ${errors.vi ? 'invalid' : ''}`} style={{ display: tab === 'vi' ? 'flex' : 'none' }}>
        Mô tả tiếng Việt
        <textarea ref={viRef} className="input" name="desc_vi" rows={7} lang="vi" defaultValue={vi} onInput={(e) => setViText(e.currentTarget.value)} />
        {errors.vi && <span className="err">{errors.vi}</span>}
      </label>
      <label className={`a-field ${errors.en ? 'invalid' : ''}`} style={{ display: tab === 'en' ? 'flex' : 'none' }}>
        English description
        <textarea ref={enRef} className="input" name="desc_en" rows={7} lang="en" defaultValue={en}
          onInput={(e) => setEnText(e.currentTarget.value)} />
        {errors.en && <span className="err">{errors.en}</span>}
      </label>
      {tab === 'en' && live === 'stale' && enText === en && (
        <label className="a-check" style={{ marginTop: 8 }}>
          <input type="checkbox" name="en_confirm" /> Bản EN vẫn đúng với nội dung VI hiện tại (đánh dấu Đã dịch khi lưu)
        </label>
      )}
      {toolsOn && <div style={{ display: tab === 'en' ? 'block' : 'none' }}><TranslateTools vi={viText} en={enText} glossary={glossary} onPaste={setEn} /></div>}
      {note && <p className="a-small a-muted" style={{ margin: '10px 0 0' }}>{note}</p>}
    </div>
  );
}
