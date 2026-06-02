export type NoteColorThemeId =
  | 'classic'
  | 'vivid'
  | 'cream'
  | 'mono'
  | 'dusk'
  | 'linen'
  | 'sakura'
  | 'night'
  | 'dark'

const VALID_IDS = new Set<NoteColorThemeId>([
  'classic', 'vivid', 'cream', 'mono', 'dusk', 'linen', 'sakura', 'night', 'dark',
])

export function isValidNoteThemeId(value: unknown): value is NoteColorThemeId {
  return typeof value === 'string' && VALID_IDS.has(value as NoteColorThemeId)
}
