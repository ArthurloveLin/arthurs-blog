const DEFAULT_TIMEOUT_MS = 15_000
const DEFAULT_MAX_RETRIES = 2
const DEFAULT_RETRYABLE_STATUSES = [408, 429, 500, 502, 503, 504]

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getRetryDelayMs(response: Response | null, attempt: number) {
  const retryAfterHeader = response?.headers.get('retry-after')
  const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN

  if (Number.isFinite(retryAfterSeconds)) {
    return Math.min(retryAfterSeconds * 1000, 5_000)
  }

  return Math.min(300 * 2 ** attempt, 2_000)
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  options: {
    timeoutMs?: number
    maxRetries?: number
    retryableStatuses?: number[]
  } = {}
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES
  const retryableStatuses = new Set(options.retryableStatuses ?? DEFAULT_RETRYABLE_STATUSES)
  let lastError: unknown = null

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!retryableStatuses.has(response.status) || attempt === maxRetries) {
        return response
      }

      await sleep(getRetryDelayMs(response, attempt))
    } catch (error) {
      clearTimeout(timeoutId)
      lastError = error

      if (attempt === maxRetries) {
        throw error
      }

      await sleep(getRetryDelayMs(null, attempt))
    }
  }

  throw (lastError instanceof Error ? lastError : new Error('Request failed after retries'))
}