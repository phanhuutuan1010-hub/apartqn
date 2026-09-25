import type { MetadataRoute } from 'next';
import vi from '@/i18n/vi.json';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `ApartQN · ${vi.tagline}`,
    short_name: 'ApartQN',
    description: vi.fAbout,
    lang: 'vi',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#FFFFFF',
    theme_color: '#0039A6',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
