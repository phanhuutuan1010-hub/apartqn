'use client';

import { useState } from 'react';
import { LOCALES, type Locale } from '@/i18n/locales';

const NAME: Record<Locale, string> = { vi: 'Tiếng Việt', en: 'English', ru: 'Русский' };

/**
 * VI | EN | RU (every site language): the description the site generates from the structured fields (read-only preview,
 * as last saved) and an optional override textarea `desc_custom_{locale}`. Empty override → the generated text is shown.
 */
export function CustomDescTabs({ generated, custom, maxLength = 5000 }: { generated: Record<Locale, string>; custom: Partial<Record<Locale, string | null>>; maxLength?: number }) {
  const [tab, setTab] = useState<Locale>(LOCALES[0]);
  const [has, setHas] = useState<Record<string, boolean>>(Object.fromEntries(LOCALES.map((l) => [l, !!custom[l]?.trim()])));
  return (
    <div className="a-desc">
      <div className="a-seg" role="tablist" aria-label="Ngôn ngữ mô tả">
        {LOCALES.map((l) => (
          <button key={l} type="button" role="tab" aria-selected={tab === l} className={tab === l ? 'on' : undefined} onClick={() => setTab(l)}>
            {l.toUpperCase()} {has[l] && <span className="a-badge blue">Tự viết</span>}
          </button>
        ))}
      </div>
      {LOCALES.map((l) => (
        <div key={l} style={{ display: tab === l ? 'flex' : 'none', flexDirection: 'column', gap: 10 }}>
          <div className="a-field">
            Mô tả tự sinh ({NAME[l]}) <span className="hint">từ loại căn, diện tích, giá, nội thất, view, đặc điểm, tiện ích và phí toà nhà · cập nhật khi Lưu</span>
            <p lang={l} style={{ margin: 0, padding: '10px 12px', borderRadius: 10, background: 'var(--gray-50)', fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-line', opacity: has[l] ? 0.55 : 1 }}>
              {generated[l] || '—'}
            </p>
          </div>
          <label className="a-field">
            Mô tả tự viết ({NAME[l]}) <span className="hint">không bắt buộc — nếu điền, website hiện đoạn này thay cho mô tả tự sinh</span>
            <textarea className="input" name={`desc_custom_${l}`} rows={5} lang={l} maxLength={maxLength} defaultValue={custom[l] ?? ''}
              onInput={(e) => { const v = !!e.currentTarget.value.trim(); setHas((h) => (h[l] === v ? h : { ...h, [l]: v })); }} />
          </label>
        </div>
      ))}
    </div>
  );
}
