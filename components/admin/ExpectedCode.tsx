'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { peekListingCode } from '@/lib/admin/listingActions';

/** fired by the listing form: the building select changed (detail = building id) / the form was saved */
export const BUILDING_EVENT = 'aqn:building', SAVED_EVENT = 'aqn:saved';

/**
 * Header of a draft / pending listing: "Mã dự kiến: ALT-002" — what the building would hand out next. Only a preview:
 * the real code is assigned when the listing is first published. Follows the building select, re-reads on window focus
 * and after a save (someone else may have published in between).
 */
export function ExpectedCode({ buildingId, initial }: { buildingId: string; initial: string | null }) {
  const [b, setB] = useState(buildingId);
  const [code, setCode] = useState(initial);
  useEffect(() => {
    let cur = b, live = true;
    const read = async (id = cur) => { const r = await peekListingCode(id); if (live && id === cur) setCode(r); };
    const onBuilding = (e: Event) => { cur = (e as CustomEvent<string>).detail; setB(cur); void read(cur); };
    const again = () => void read();
    window.addEventListener(BUILDING_EVENT, onBuilding);
    window.addEventListener(SAVED_EVENT, again);
    window.addEventListener('focus', again);
    return () => { live = false; window.removeEventListener(BUILDING_EVENT, onBuilding); window.removeEventListener(SAVED_EVENT, again); window.removeEventListener('focus', again); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!code) return <span>Toà chưa có tiền tố mã · <Link href={`/admin/toa-nha/${b}`} style={{ color: 'var(--blue-500)' }}>mở trang toà nhà</Link></span>;
  return <span>Mã dự kiến: {code} <span className="a-small a-muted" style={{ fontWeight: 400 }}>Cấp chính thức khi đăng</span></span>;
}
