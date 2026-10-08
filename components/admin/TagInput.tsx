'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

type Props = { name: string; defaultValue: string[]; max?: number; maxLength?: number; placeholder?: string; id?: string };

/** Chips + free text. Enter, comma or Tab adds; Backspace on empty removes the last. Posts one `name` field per tag. */
export function TagInput({ name, defaultValue, max = 20, maxLength = 60, placeholder, id }: Props) {
  const [tags, setTags] = useState(defaultValue);
  const [draft, setDraft] = useState('');
  const add = (raw: string) => {
    const v = raw.trim().replace(/\s+/g, ' ').slice(0, maxLength);
    if (!v || tags.length >= max || tags.some((t) => t.toLowerCase() === v.toLowerCase())) return;
    setTags([...tags, v]);
  };
  return (
    <div className="a-tags input" onClick={(e) => (e.currentTarget.querySelector('input') as HTMLInputElement | null)?.focus()}>
      {tags.map((t, i) => (
        <span key={t} className="a-tag" lang="und">
          {t}
          <input type="hidden" name={name} value={t} />
          <button type="button" aria-label={`Xoá “${t}”`} onClick={() => setTags(tags.filter((_, j) => j !== i))}><X size={13} aria-hidden /></button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        maxLength={maxLength}
        placeholder={tags.length ? '' : placeholder}
        disabled={tags.length >= max}
        onChange={(e) => {
          const v = e.target.value;
          if (v.includes(',')) { v.split(',').slice(0, -1).forEach(add); setDraft(v.split(',').pop() ?? ''); }
          else setDraft(v);
        }}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || (e.key === 'Tab' && draft.trim())) && !e.nativeEvent.isComposing) {
            e.preventDefault();
            add(draft);
            setDraft('');
          } else if (e.key === 'Backspace' && !draft && tags.length) setTags(tags.slice(0, -1));
        }}
        onBlur={() => { if (draft.trim()) { add(draft); setDraft(''); } }}
      />
    </div>
  );
}
