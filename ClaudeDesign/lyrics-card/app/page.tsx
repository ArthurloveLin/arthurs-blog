// app/page.tsx
// Server component — fetches (or imports) track data, renders the client shell.
//
// Production extension: replace the static import with an API call:
//   const track = await fetch(`https://api.genius.com/songs/${id}`, { next: { revalidate: 3600 } })
//   const annotations = await fetch(`/api/genius/annotations?songId=${id}`)

import { BehindTheLyricsPage } from '@/components/BehindTheLyrics'
import { TRACK, ANNOTATIONS } from '@/data/track'

export default function Page() {
  return (
    <BehindTheLyricsPage
      track={TRACK}
      annotations={ANNOTATIONS}
      config={{
        highlightStyle:    'dashed',
        popoverPosition:   'follow',
        showSectionLabels: true,
        lyricSize:         22,
      }}
    />
  )
}
