import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    viewTransition: true,
  },
  transpilePackages: ["tegaki"],
  outputFileTracingRoot: process.cwd(),

  async headers() {
    return [
      {
        source: '/blog/:slug',
        headers: [
          {
            key: 'CDN-Cache-Control',
            value: 'public, s-maxage=3600, stale-while-revalidate=86400',
          },
        ],
      },
      {
        source: '/',
        headers: [
          {
            key: 'CDN-Cache-Control',
            value: 'public, s-maxage=300, stale-while-revalidate=3600',
          },
        ],
      },
      {
        source: '/(tag|category|archive|life-gallery|now-watching)/:path*',
        headers: [
          {
            key: 'CDN-Cache-Control',
            value: 'public, s-maxage=1800, stale-while-revalidate=86400',
          },
        ],
      },
      {
        source: '/(memo|guestbook)',
        headers: [
          {
            key: 'CDN-Cache-Control',
            value: 'public, s-maxage=120, stale-while-revalidate=3600',
          },
        ],
      },
      {
        source: '/wardrobe',
        headers: [
          {
            key: 'CDN-Cache-Control',
            value: 'no-store',
          },
        ],
      },
    ]
  },
  images: {
    dangerouslyAllowLocalIP: true,
    qualities: [72, 75],
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
      {
        protocol: 'https',
        hostname: 'img.arthurlovegrace.top',
      },
    ],
  },
};

export default nextConfig;
