function normalizeCacheTagSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown'
}

export const AGENT_RUNTIME_CACHE_TAGS = {
  threads: 'agent-threads',
  runs: 'agent-runs',
} as const

export function getAgentThreadTag(threadId: string) {
  return `agent-thread-${normalizeCacheTagSegment(threadId)}`
}

export function getAgentRunTag(runId: string) {
  return `agent-run-${normalizeCacheTagSegment(runId)}`
}