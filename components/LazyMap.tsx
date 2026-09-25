'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { MapMarker } from './MapView';

const MapView = dynamic(() => import('./MapView'), { ssr: false });

/** Loads Leaflet only when the block scrolls near the viewport. */
export function LazyMap({ markers, ariaLabel, loadingLabel }: { markers: MapMarker[]; ariaLabel: string; loadingLabel: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setShow(true); io.disconnect(); } }, { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ position: 'absolute', inset: 0 }}>
      {show ? <MapView markers={markers} zoom={16} ariaLabel={ariaLabel} /> : <span className="ph-label" style={{ position: 'absolute', left: 12, top: 12 }}>{loadingLabel}</span>}
    </div>
  );
}
