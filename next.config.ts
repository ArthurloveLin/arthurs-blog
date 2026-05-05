import type { NextConfig } from "next";
import bundleAnalyzer from '@next/bundle-analyzer';

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
  experimental: {
    viewTransition: true,
  },
  output: 'standalone',
  transpilePackages: ["tegaki"],
  outputFileTracingRoot: process.cwd(),

  async headers() {
    return [
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
    dangerouslyAllowLocalIP: process.env.NODE_ENV === 'development',
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

export default withBundleAnalyzer(nextConfig);
