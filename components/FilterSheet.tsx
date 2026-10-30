'use client';

import { useEffect, useId } from 'react';
import type { Building, UnitType } from '@/lib/types';
import type { Filters } from '@/lib/filters';
import { FilterPanel } from './FilterPanel';
import styles from './FilterSheet.module.css';

type Props = { value: Filters; types: UnitType[]; buildings: Pick<Building, 'id' | 'name'>[]; onApply: (f: Filters) => void; onClose: () => void };

/** Bottom sheet (< 1024) with backdrop; loaded on demand via next/dynamic. */
export default function FilterSheet({ value, types, buildings, onApply, onClose }: Props) {
  const titleId = useId();

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', onKey); };
  }, [onClose]);

  return (
    <div className={styles.root}>
      <div className={styles.backdrop} onClick={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className={styles.sheet}>
        <FilterPanel variant="sheet" value={value} types={types} buildings={buildings} onApply={onApply} onClose={onClose} titleId={titleId} />
      </div>
    </div>
  );
}
