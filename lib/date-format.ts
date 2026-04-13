const DEFAULT_LOCALE = 'zh-CN'
const DEFAULT_TIME_ZONE = 'Asia/Shanghai'

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