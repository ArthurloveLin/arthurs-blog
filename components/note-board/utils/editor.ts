import type { ChecklistItemDraft, TextEditResult } from '@/components/note-board/types'
import { clamp } from '@/components/note-board/utils/board'

function buildChecklistItem(text = '', checked = false, id?: string): ChecklistItemDraft {
  return {
    id: id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text,
    checked,
  }
}

const CHECKLIST_PARSE_PATTERN = /^[-*]\s+\[( |x|X)\]\s+(.*)$/

function getSelectionBlock(value: string, start: number, end: number) {
  const safeStart = clamp(start, 0, value.length)
  const safeEnd = clamp(end, 0, value.length)
  const blockStart = value.lastIndexOf('\n', Math.max(safeStart - 1, 0)) + 1
  const nextBreak = value.indexOf('\n', safeEnd)
  const blockEnd = nextBreak === -1 ? value.length : nextBreak

  return {
    start: blockStart,
    end: blockEnd,
    text: value.slice(blockStart, blockEnd),
  }
}

function replaceRange(value: string, start: number, end: number, insertion: string, selectionStart: number, selectionEnd = selectionStart): TextEditResult {
  return {
    value: `${value.slice(0, start)}${insertion}${value.slice(end)}`,
    selection: { start: selectionStart, end: selectionEnd },
  }
}

export function wrapSelectionWithSyntax(value: string, start: number, end: number, prefix: string, suffix = prefix): TextEditResult {
  const selectedText = value.slice(start, end)
  const insertion = `${prefix}${selectedText}${suffix}`
  const caretStart = start + prefix.length
  const caretEnd = selectedText ? end + prefix.length : caretStart
  return replaceRange(value, start, end, insertion, caretStart, caretEnd)
}

export function insertChecklistSyntax(value: string, start: number, end: number): TextEditResult {
  if (start !== end) {
    const block = getSelectionBlock(value, start, end)
    const converted = block.text
      .split('\n')
      .map((line) => {
        const normalized = line.replace(/^[-*]\s+\[(?: |x|X)\]\s+/, '').trim()
        return `- [ ] ${normalized}`
      })
      .join('\n')

    return replaceRange(value, block.start, block.end, converted, block.start, block.start + converted.length)
  }

  const block = getSelectionBlock(value, start, end)
  if (block.text.trim().length === 0) {
    return replaceRange(value, block.start, block.end, '- [ ] ', block.start + 6)
  }

  const prefix = start > 0 && value[start - 1] !== '\n' ? '\n' : ''
  const insertion = `${prefix}- [ ] `
  return replaceRange(value, start, end, insertion, start + insertion.length)
}

export function parseNoteContent(content: string) {
  const lines = content.split('\n')
  const bodyLines: string[] = []
  const checklistItems: ChecklistItemDraft[] = []

  for (const [index, line] of lines.entries()) {
    const match = line.match(CHECKLIST_PARSE_PATTERN)
    if (match) {
      checklistItems.push({
        ...buildChecklistItem(match[2], match[1].toLowerCase() === 'x', `parsed-${index}-${match[2]}`),
        lineIndex: index,
      })
      continue
    }

    bodyLines.push(line)
  }

  return {
    body: bodyLines.join('\n').trim(),
    checklistItems,
  }
}

export function insertLinePrefixSyntax(value: string, start: number, end: number, prefix: string): TextEditResult {
  const block = getSelectionBlock(value, start, end)
  const lines = block.text.split('\n')
  const alreadyPrefixed = lines.every((line) => line.startsWith(prefix))
  const converted = alreadyPrefixed
    ? lines.map((line) => line.slice(prefix.length)).join('\n')
    : lines.map((line) => `${prefix}${line}`).join('\n')
  return replaceRange(value, block.start, block.end, converted, block.start, block.start + converted.length)
}

const INLINE_DUE_PATTERN = /@due\[[^\]]*\]\([^)]*\)/g
const INLINE_DUE_CAPTURE = /@due\[([^\]]*)\]\(([^)]*)\)/g

// Tag format: @due[label](iso) or @due[label](iso,daily|weekdays|custom:0,1,2)
function splitDueParens(raw: string): { iso: string; repeatSpec: string } {
  const comma = raw.indexOf(',')
  if (comma === -1) return { iso: raw, repeatSpec: '' }
  return { iso: raw.slice(0, comma), repeatSpec: raw.slice(comma + 1) }
}

export function parseRepeatSpec(spec: string): { repeatMode: string; repeatDays: number[] | null } {
  if (!spec) return { repeatMode: 'once', repeatDays: null }
  if (spec === 'daily') return { repeatMode: 'daily', repeatDays: null }
  if (spec === 'weekdays') return { repeatMode: 'weekdays', repeatDays: null }
  if (spec.startsWith('custom:')) {
    const days = spec.slice(7).split(',').map(Number).filter((d) => !isNaN(d) && d >= 0 && d <= 6)
    return { repeatMode: 'custom', repeatDays: days.length > 0 ? days : null }
  }
  return { repeatMode: 'once', repeatDays: null }
}

export function parseInlineDueTags(content: string): Array<{ label: string; iso: string; repeatMode: string; repeatDays: number[] | null; fullMatch: string; rawParens: string }> {
  const result: Array<{ label: string; iso: string; repeatMode: string; repeatDays: number[] | null; fullMatch: string; rawParens: string }> = []
  INLINE_DUE_CAPTURE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = INLINE_DUE_CAPTURE.exec(content)) !== null) {
    const { iso, repeatSpec } = splitDueParens(match[2])
    if (!iso || isNaN(Date.parse(iso))) continue
    const { repeatMode, repeatDays } = parseRepeatSpec(repeatSpec)
    result.push({ label: match[1], iso, repeatMode, repeatDays, fullMatch: match[0], rawParens: match[2] })
  }
  return result
}

export function extractEarliestDueAt(content: string): string | null {
  const tags = parseInlineDueTags(content)
  if (tags.length === 0) return null
  return tags.reduce((earliest, t) => Date.parse(t.iso) < Date.parse(earliest) ? t.iso : earliest, tags[0].iso)
}

export function hasInlineDueTags(content: string): boolean {
  INLINE_DUE_PATTERN.lastIndex = 0
  return INLINE_DUE_PATTERN.test(content)
}

const HASHTAG_PATTERN = /#([\p{L}\p{N}_-]+)/gu

export function parseHashtags(content: string): string[] {
  const seen = new Set<string>()
  let match: RegExpExecArray | null
  HASHTAG_PATTERN.lastIndex = 0
  while ((match = HASHTAG_PATTERN.exec(content)) !== null) {
    const tag = match[1].toLowerCase()
    if (tag.length > 0 && tag.length <= 32) {
      seen.add(tag)
    }
    HASHTAG_PATTERN.lastIndex = match.index + 1
  }
  return [...seen].sort()
}

export function toggleChecklistLine(content: string, lineIndex: number) {
  const lines = content.split('\n')

  if (lineIndex < 0 || lineIndex >= lines.length) {
    return content
  }

  const targetLine = lines[lineIndex]
  const match = targetLine.match(CHECKLIST_PARSE_PATTERN)
  if (!match) {
    return content
  }

  lines[lineIndex] = `- [${match[1].toLowerCase() === 'x' ? ' ' : 'x'}] ${match[2]}`
  return lines.join('\n')
}
