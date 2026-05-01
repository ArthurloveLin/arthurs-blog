// lib/types.ts

export interface AlbumPalette {
  bg: string
  bgDeep: string
  paper: string
  ink: string
  ink2: string
  ink3: string
  accent: string
  accentSoft: string
  accent2: string
  warm: string
  line: string
}

export type Segment =
  | { text: string; ref?: undefined }
  | { text: string; ref: string }

export interface Section {
  label: string | null
  lines: Segment[][]
}

export interface Track {
  title: string
  artist: string
  album: string
  palette: AlbumPalette
  sections: Section[]
}

export interface Annotation {
  title: string
  quote: string
  body: string
  helpful: number
}

export type AnnotationMap = Record<string, Annotation>

export type HighlightStyle = 'dashed' | 'solid' | 'fill' | 'edge'
export type PopoverPosition = 'follow' | 'anchor'

export interface ReaderConfig {
  highlightStyle: HighlightStyle
  popoverPosition: PopoverPosition
  showSectionLabels: boolean
  lyricSize: number
}
