import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Arthur & Grace',
    short_name: 'Memo',
    description: '便签',
    start_url: '/memo',
    scope: '/',
    display: 'standalone',
    background_color: '#fcfcfc',
    theme_color: '#7c3aed',
    icons: [
      {
        src: '/icons/pwa-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/pwa-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
