'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { upload } from '@vercel/blob/client';
import { compressImage } from '@/lib/compressImage';
import { F, m2 } from '@/lib/format';
import styles from './Forms.module.css';

const MAX = 10;

type Props = { buildings: { id: string; name: string }[] };

/** building · floor/area/beds · asking rent · photos (≤10, compressed, direct to Vercel Blob) · owner, phone */
export function ConsignForm({ buildings }: Props) {
  const t = useTranslations();
  const l = useLocale();
  const selRef = useRef<HTMLSelectElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [tooMany, setTooMany] = useState(false);
  const [over, setOver] = useState(false);
  const [state, setState] = useState<'idle' | 'uploading' | 'busy' | 'done' | 'error'>('idle');

  // ?b=<building id> preselects the building (read on the client so the page stays static)
  useEffect(() => {
    const pre = new URLSearchParams(window.location.search).get('b') ?? '';
    if (selRef.current && buildings.some((x) => x.id === pre)) selRef.current.value = pre;
  }, [buildings]);

  const pick = (list: FileList | null) => {
    const imgs = Array.from(list ?? []).filter((f) => f.type.startsWith('image/'));
    setTooMany(imgs.length > MAX);
    setFiles(imgs.slice(0, MAX));
  };

  const uploadAll = async (): Promise<{ urls: string[]; failed: number }> => {
    const urls: string[] = [];
    let failed = 0;
    // 3 at a time
    for (let i = 0; i < files.length; i += 3) {
      const batch = files.slice(i, i + 3);
      const res = await Promise.allSettled(
        batch.map(async (f, k) => {
          const blob = await compressImage(f);
          const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
          const r = await upload(`consign/${Date.now()}-${i + k + 1}.${ext}`, blob, { access: 'public', handleUploadUrl: '/api/upload', contentType: blob.type || 'image/jpeg' });
          return r.url;
        }),
      );
      res.forEach((r) => (r.status === 'fulfilled' ? urls.push(r.value) : failed++));
    }
    return { urls, failed };
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (state === 'busy' || state === 'uploading') return;
    const fd = new FormData(e.currentTarget);
    const g = (k: string) => (fd.get(k) ?? '').toString().trim();
    let photos: string[] = [];
    let photosFailed = 0;
    if (files.length) {
      setState('uploading');
      const r = await uploadAll();
      photos = r.urls;
      photosFailed = r.failed;
    }
    setState('busy');
    try {
      const r = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'consign', building: g('building'), floor: g('floor'), area: g('area'), beds: g('beds'), rent: g('rent'),
          owner: g('owner'), phone: g('phone'), photos, photosFailed, locale: l, page: location.href, website: g('website'),
        }),
      });
      if (!r.ok) throw new Error(String(r.status));
      setState('done');
      setFiles([]);
      setTooMany(false);
    } catch {
      setState('error');
    }
  };

  if (state === 'done') {
    return (
      <div className={styles.cfDone} role="status">
        <span className={styles.cfCheck} aria-hidden>✓</span>
        <span className={styles.cfDoneT}>{t('cfDone')}</span>
        <span className={styles.cfDoneS}>{t('cfDoneSub')}</span>
        <button type="button" className="btn btn-secondary" onClick={() => setState('idle')}>{t('vrAgain')}</button>
      </div>
    );
  }

  const busy = state === 'busy' || state === 'uploading';
  return (
    <form className={styles.cf} onSubmit={submit}>
      <div className={styles.cfHead}>
        <h2 className={styles.cfTitle}>{t('cfTitle')}</h2>
        <p className={styles.cfSub}>{t('cfSub')}</p>
      </div>
      <div className="eyebrow">{t('cfUnit')}</div>
      <label className="field">{t('building')}
        <select ref={selRef} className="input" name="building" defaultValue="">
          <option value="">{t('selectPh')}</option>
          {buildings.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      </label>
      <div className={styles.three}>
        <label className="field">{t('floor')}<input className="input" name="floor" inputMode="numeric" maxLength={4} placeholder="12" /></label>
        <label className="field">{t('area')}, {m2(l)}<input className="input" name="area" inputMode="decimal" maxLength={6} placeholder="65" /></label>
        <label className="field">{t('bedrooms')}<input className="input" name="beds" inputMode="numeric" maxLength={2} placeholder="2" /></label>
      </div>
      <label className="field">{t('cfRent')}
        <input className="input" name="rent" required inputMode="numeric" maxLength={30} placeholder="10.000.000" />
      </label>
      <div className="field">
        <span>{t('cfPhotos')}</span>
        <label
          className={`${styles.drop} ${over ? styles.dropOver : ''}`}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files); }}
        >
          <span className={styles.plus} aria-hidden>+</span>
          <span className={styles.dropT}>{t('cfDrop')}</span>
          <span className={styles.dropH}>{t('cfDropHint')}</span>
          {files.length > 0 && <span className={styles.files}>✓ {F.photos(files.length, l)}</span>}
          {tooMany && <span className={styles.warn}>{t('cfTooMany')}</span>}
          <input className={styles.fileInput} type="file" name="photos" multiple accept="image/jpeg,image/png,image/webp,image/heic,image/*" onChange={(e) => pick(e.target.files)} aria-label={t('cfPhotos')} />
        </label>
      </div>
      <div className="eyebrow">{t('cfContact')}</div>
      <div className={styles.two}>
        <label className="field">{t('vrName')}<input className="input" name="owner" required maxLength={120} autoComplete="name" placeholder={t('vrNamePh')} /></label>
        <label className="field">{t('vrPhone')}<input className="input" name="phone" required type="tel" inputMode="tel" minLength={6} maxLength={30} autoComplete="tel" placeholder="+84 9xx xxx xxx" /></label>
      </div>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className={styles.hp} aria-hidden />
      {state === 'error' && <span className={styles.err} role="alert">{t('sendErr')}</span>}
      <button type="submit" className={`btn btn-primary ${styles.submit}`} disabled={busy}>
        {state === 'uploading' ? t('cfUploading') : state === 'busy' ? t('sending') : t('cfSubmit')}
      </button>
    </form>
  );
}
