import type { SpotifyRecentlyPlayedTrack, TimeSegment, TimeSegmentId } from './spotify-types'

export const TIME_SEGMENTS: TimeSegment[] = [
  { id: 'dawn', label: '凌晨', startHour: 0, endHour: 6 },
  { id: 'morning', label: '早晨', startHour: 6, endHour: 10 },
  { id: 'noon', label: '上午', startHour: 10, endHour: 12 },
  { id: 'afternoon', label: '下午', startHour: 12, endHour: 18 },
  { id: 'evening', label: '傍晚', startHour: 18, endHour: 21 },
  { id: 'night', label: '深夜', startHour: 21, endHour: 24 },
]

function parseDayKey(dayKey: string) {
  const [year, month, day] = dayKey.split('-').map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1)
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