export interface GeniusAnnotation {
  id: number
  body: string
  fragment: string
  url: string
  votes?: number
}

export interface GeniusSongData {
  geniusId: number
  title: string
  artist: string
  album?: string
  releaseDate?: string
  geniusUrl: string
  pageViews?: number
  lyrics?: string
  annotations: GeniusAnnotation[]
  cachedAt: string
}
