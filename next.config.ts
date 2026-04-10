import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    viewTransition: true,
  },
  async headers() {
    return [
      {
        source: '/blog/:slug',
        headers: [
          {
            key: 'CDN-Cache-Control',
            value: 'public, s-maxage=0, stale-while-revalidate=86400',
          },
        ],
      },
      {
        source: '/',
        headers: [
          {
            key: 'CDN-Cache-Control',
            value: 'public, s-maxage=0, stale-while-revalidate=3600',
          },
        ],
      },
      {
        source: '/(tag|blog/category|archive|wardrobe|life-gallery)/:path*',
        headers: [
          {
            key: 'CDN-Cache-Control',
            value: 'public, s-maxage=0, stale-while-revalidate=3600',
          },
        ],
      },
    ]
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'api.arthurlovegrace.top',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'images.arthurlovegrace.top',
      },
      {
        protocol: 'https',
        hostname: 'obsidian.arthurlovegrace.top',
      },
    ],
  },
};

export default nextConfig;
