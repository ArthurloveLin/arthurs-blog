const DEFAULT_LOCALE = 'zh-CN'
const DEFAULT_TIME_ZONE = 'Asia/Shanghai'
const SHANGHAI_OFFSET = '+08:00'
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const DATE_TIME_WITHOUT_ZONE_PATTERN = /^(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/

type StableFormatOptions = Omit<Intl.DateTimeFormatOptions, 'timeZone'>

const formatterCache = new Map<string, Intl.DateTimeFormat>()

function getFormatter(options: StableFormatOptions) {
  const key = JSON.stringify(options)
  const cached = formatterCache.get(key)
  if (cached) return cached

  const formatter = new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    ...options,
    timeZone: DEFAULT_TIME_ZONE,
  })

  formatterCache.set(key, formatter)
  return formatter
}

function toValidDate(value: string | number | Date) {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatStableDate(value: string | number | Date, options: StableFormatOptions) {
  const date = toValidDate(value)
  if (!date) return ''
  return getFormatter(options).format(date)
}

export function formatLongDate(value: string | number | Date) {
  return formatStableDate(value, { year: 'numeric', month: 'long', day: 'numeric' })
}

export function formatShortDate(value: string | number | Date) {
  return formatStableDate(value, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function formatCommentTimestamp(value: string | number | Date) {
  return formatStableDate(value, {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function hasEditedTimestamp(createdAt: string | number | Date, updatedAt?: string | number | Date | null) {
  if (!updatedAt) return false

  const createdDate = toValidDate(createdAt)
  const updatedDate = toValidDate(updatedAt)
  if (!createdDate || !updatedDate) return false

  return updatedDate.getTime() - createdDate.getTime() > 1_000
}

export function formatCommentTimeLabel(createdAt: string | number | Date, updatedAt?: string | number | Date | null) {
  if (hasEditedTimestamp(createdAt, updatedAt)) {
    return `已编辑于 ${formatCommentTimestamp(updatedAt as string | number | Date)}`
  }

  return formatCommentTimestamp(createdAt)
}

export function getStableYear(value: string | number | Date = new Date()) {
  const year = formatStableDate(value, { year: 'numeric' })
  return Number.parseInt(year, 10)
}

export function formatBlogPublishedDate(value: string | number | Date) {
  return formatLongDate(value)
}

export function parseBlogFrontmatterDate(value: unknown, fallback = new Date()) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? fallback.toISOString() : value.toISOString()
  }

  if (typeof value === 'number') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? fallback.toISOString() : date.toISOString()
  }

  if (typeof value !== 'string') {
    return fallback.toISOString()
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return fallback.toISOString()
  }

  if (DATE_ONLY_PATTERN.test(trimmed)) {
    return new Date(`${trimmed}T00:00:00${SHANGHAI_OFFSET}`).toISOString()
  }

  const dateTimeWithoutZoneMatch = trimmed.match(DATE_TIME_WITHOUT_ZONE_PATTERN)
  if (dateTimeWithoutZoneMatch) {
    const [, datePart, timePart, seconds = '00', milliseconds] = dateTimeWithoutZoneMatch
    const normalizedMilliseconds = milliseconds
      ? `.${milliseconds.padEnd(3, '0').slice(0, 3)}`
      : ''

    return new Date(`${datePart}T${timePart}:${seconds}${normalizedMilliseconds}${SHANGHAI_OFFSET}`).toISOString()
  }

  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? fallback.toISOString() : parsed.toISOString()
}