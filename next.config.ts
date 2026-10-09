import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : undefined;

const nextConfig: NextConfig = {
  images: {
    // photos are served from the public Supabase Storage bucket
    remotePatterns: supabaseHost ? [{ protocol: 'https', hostname: supabaseHost, pathname: '/storage/v1/object/public/listing-public/**' }] : [],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [360, 480, 640, 768, 1024, 1280, 1600, 1920],
  },
  poweredByHeader: false,
  // the only frames the site embeds are Google Maps (building / listing "Vị trí", admin preview)
  async headers() {
    return [{ source: '/:path*', headers: [{ key: 'Content-Security-Policy', value: 'frame-src https://www.google.com https://maps.google.com' }] }];
  },
  // admin pages merged in the quick-ops cleanup
  async redirects() {
    return [
      { source: '/admin/duyet-tin', destination: '/admin', permanent: true },
      { source: '/admin/cho-xu-ly', destination: '/admin/khach-hang?type=consign', permanent: true },
    ];
  },
};

export default withNextIntl(nextConfig);
