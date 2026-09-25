'use client';

import { useMemo } from 'react';
import { MapContainer, Marker, TileLayer, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MAP_VIEW } from '@/data/site';
import styles from './MapView.module.css';

export type MapMarker = { id: string; lat: number; lng: number; label: string; sub?: string; selected?: boolean };

type Props = { markers: MapMarker[]; onSelect?: (id: string) => void; zoom?: number; className?: string; ariaLabel: string };

/** OpenStreetMap via react-leaflet. Import with next/dynamic({ ssr: false }). Only verified coordinates become markers. */
export default function MapView({ markers, onSelect, zoom, className, ariaLabel }: Props) {
  const center: [number, number] = markers.length === 1 ? [markers[0].lat, markers[0].lng] : MAP_VIEW.center;
  const icons = useMemo(
    () =>
      markers.map((m) =>
        L.divIcon({
          className: '',
          html: `<span class="${styles.pin} ${m.selected ? styles.pinOn : ''}">${escapeHtml(m.label)}${m.sub ? `<small>· ${escapeHtml(m.sub)}</small>` : ''}</span>`,
          iconSize: undefined,
          iconAnchor: [0, 0],
        }),
      ),
    [markers],
  );

  return (
    <div className={`${styles.wrap} ${className ?? ''}`} role="region" aria-label={ariaLabel}>
      <MapContainer center={center} zoom={zoom ?? MAP_VIEW.zoom} scrollWheelZoom={false} zoomControl={false} className={styles.map}>
        <ZoomControl position="topright" />
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {markers.map((m, i) => (
          <Marker key={m.id} position={[m.lat, m.lng]} icon={icons[i]} zIndexOffset={m.selected ? 1000 : 0} eventHandlers={onSelect ? { click: () => onSelect(m.id) } : undefined} title={m.label} />
        ))}
      </MapContainer>
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}
