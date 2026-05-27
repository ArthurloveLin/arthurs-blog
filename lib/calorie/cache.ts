function normalizeCacheTagSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown'
}

export const CALORIE_CACHE_TAGS = {
  workspaces: 'calorie-workspaces',
  reports: 'calorie-reports',
} as const

export function getCalorieWorkspaceTag(workspaceId: string) {
  return `calorie-workspace-${normalizeCacheTagSegment(workspaceId)}`
}

export function getCalorieDayTag(date: string) {
  return `calorie-day-${normalizeCacheTagSegment(date)}`
}

export function getCalorieReportTag(period: string, anchor: string) {
  return `calorie-report-${normalizeCacheTagSegment(period)}-${normalizeCacheTagSegment(anchor)}`
}