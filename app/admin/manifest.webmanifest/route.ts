/** Installable admin (PWA): its own scope so it opens on /admin and stays separate from the public site's manifest. */
export const dynamic = 'force-static';

export function GET() {
  return Response.json(
    {
      id: '/admin',
      name: 'ApartQN · Quản trị',
      short_name: 'ApartQN QT',
      description: 'Quản lý căn hộ, khách và ký gửi',
      lang: 'vi',
      start_url: '/admin',
      scope: '/admin',
      display: 'standalone',
      orientation: 'portrait',
      background_color: '#FFFFFF',
      theme_color: '#0039A6',
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
      shortcuts: [
        { name: 'Thêm căn', url: '/admin/can-ho/moi' },
        { name: 'Khách', url: '/admin/khach-hang' },
      ],
    },
    { headers: { 'Content-Type': 'application/manifest+json', 'X-Robots-Tag': 'noindex', 'Cache-Control': 'public, max-age=3600' } },
  );
}
