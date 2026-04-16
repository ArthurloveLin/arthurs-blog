export const SEARCH_MIN_QUERY_LENGTH = 2

export type SearchMatchField = 'title' | 'summary' | 'tags' | 'category' | 'content'

export function normalizeSearchQuery(query: string): string {
  return query.replace(/\s+/g, ' ').trim()
}

export function tokenizeSearchQuery(query: string): string[] {
  return normalizeSearchQuery(query)
    .split(' ')
    .map((token) => token.trim())
    .filter(Boolean)
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function splitHighlightedText(text: string, query: string): Array<{ text: string; match: boolean }> {
  const tokens = tokenizeSearchQuery(query)
  if (!text || tokens.length === 0) {
    return [{ text, match: false }]
  }

  const pattern = tokens.map(escapeRegExp).join('|')
  if (!pattern) {
    return [{ text, match: false }]
  }

  const regex = new RegExp(`(${pattern})`, 'gi')
  const parts = text.split(regex).filter(Boolean)

  return parts.map((part) => ({
    text: part,
    match: tokens.some((token) => part.toLowerCase() === token.toLowerCase()),
  }))
}

export function stripMarkdownToText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, ' $1 ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/[|*_~>#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function buildSearchSnippet(text: string, query: string, maxLength = 180): string {
  const source = text.trim()
  if (!source) {
    return ''
  }

  const tokens = tokenizeSearchQuery(query)
  if (tokens.length === 0) {
    return source.slice(0, maxLength)
  }

  const lowerSource = source.toLowerCase()
  let bestIndex = -1

  for (const token of tokens) {
    const index = lowerSource.indexOf(token.toLowerCase())
    if (index !== -1 && (bestIndex === -1 || index < bestIndex)) {
      bestIndex = index
    }
  }

  if (bestIndex === -1) {
    return source.slice(0, maxLength)
  }

  const contextRadius = Math.max(40, Math.floor(maxLength / 2))
  const start = Math.max(0, bestIndex - contextRadius)
  const end = Math.min(source.length, bestIndex + contextRadius)
  const prefix = start > 0 ? '…' : ''
  const suffix = end < source.length ? '…' : ''

  return `${prefix}${source.slice(start, end).trim()}${suffix}`
}