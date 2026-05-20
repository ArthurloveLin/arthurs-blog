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
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  }
}
