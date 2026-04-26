import type { SpotifyRecentlyPlayedTrack, TimeSegment, TimeSegmentId } from './spotify-types'

export function groupTracksByHour(tracks: SpotifyRecentlyPlayedTrack[]): Map<number, SpotifyRecentlyPlayedTrack[]> {
  const map = new Map<number, SpotifyRecentlyPlayedTrack[]>()
  for (let h = 0; h < 24; h++) map.set(h, [])
  for (const track of tracks) {
    const hour = new Date(track.playedAt).getHours()
    map.get(hour)?.push(track)
  }
  return map
}

export const TIME_SEGMENTS: TimeSegment[] = [
  { id: 'dawn', label: '凌晨', startHour: 0, endHour: 6 },
  { id: 'morning', label: '早晨', startHour: 6, endHour: 9 },
  { id: 'noon', label: '上午', startHour: 9, endHour: 12 },
  { id: 'afternoon', label: '下午', startHour: 12, endHour: 18 },
  { id: 'evening', label: '傍晚', startHour: 18, endHour: 21 },
  { id: 'night', label: '深夜', startHour: 21, endHour: 24 },
]

const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function parseDayKey(dayKey: string) {
  const [year, month, day] = dayKey.split('-').map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1)
}

function toDayKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function segmentTracksByTime(
  tracks: SpotifyRecentlyPlayedTrack[],
  segments: TimeSegment[] = TIME_SEGMENTS
) {
  const grouped = new Map<TimeSegmentId, SpotifyRecentlyPlayedTrack[]>()

  for (const segment of segments) {
    grouped.set(segment.id, [])
  }

  for (const track of tracks) {
    const hour = new Date(track.playedAt).getHours()
    const segment = segments.find((item) => hour >= item.startHour && hour < item.endHour)

    if (!segment) {
      continue
    }

    grouped.get(segment.id)?.push(track)
  }

  return grouped
}

export function formatDateLabel(dateStr: string) {
  const target = parseDayKey(dateStr)
  const today = new Date()
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const yesterdayStart = new Date(todayStart)
  yesterdayStart.setDate(todayStart.getDate() - 1)

  if (target.getTime() === todayStart.getTime()) {
    return '今天'
  }

  if (target.getTime() === yesterdayStart.getTime()) {
    return '昨天'
  }

  return `${target.getMonth() + 1}月${target.getDate()}日`
}

export function formatWeekdayLabel(dateStr: string) {
  return WEEKDAY_LABELS[parseDayKey(dateStr).getDay()] ?? ''
}

export function formatCompactDateLabel(dateStr: string) {
  const target = parseDayKey(dateStr)
  return `${String(target.getMonth() + 1).padStart(2, '0')}/${String(target.getDate()).padStart(2, '0')}`
}

export function formatFullDateLabel(dateStr: string) {
  const target = parseDayKey(dateStr)
  return `${target.getFullYear()}年${target.getMonth() + 1}月${target.getDate()}日 ${formatWeekdayLabel(dateStr)}`
}

export function buildWeekDayKeys(anchorDateStr: string | null) {
  const anchor = anchorDateStr ? parseDayKey(anchorDateStr) : new Date()
  const normalizedAnchor = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate())
  const weekday = normalizedAnchor.getDay() === 0 ? 7 : normalizedAnchor.getDay()
  const monday = new Date(normalizedAnchor)
  monday.setDate(normalizedAnchor.getDate() - (weekday - 1))

  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(monday)
    current.setDate(monday.getDate() + index)
    return toDayKey(current)
  })
}
