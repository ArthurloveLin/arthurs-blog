import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Allow album art from Genius CDN / Spotify CDN
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.genius.com' },
      { protocol: 'https', hostname: 'i.scdn.co' },
    ],
  },
}

export default nextConfig
