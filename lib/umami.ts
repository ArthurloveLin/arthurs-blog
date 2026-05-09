type TokenCache = {
  token: string
  expiresAt: number
}

let tokenCache: TokenCache | null = null

const UPSTREAM_TIMEOUT_MS = 5000
const UPSTREAM_RETRIES = 1

export function getUmamiConfig() {
  const endpoint = process.env.UMAMI_ENDPOINT
  const websiteId = process.env.UMAMI_WEBSITE_ID

  if (!endpoint || !websiteId) {
    return {
      error: 'UMAMI_ENDPOINT or UMAMI_WEBSITE_ID is not configured on server.',
    }
  }

  return {
    endpoint: endpoint.replace(/\/$/, ''),
    websiteId,
  }
}

export async function getUmamiAuthToken(endpoint: string) {
  const staticToken = process.env.UMAMI_API_TOKEN
  if (staticToken) {
    return staticToken
  }

  const now = Date.now()
  if (tokenCache && tokenCache.expiresAt > now) {
    return tokenCache.token
  }

  const username = process.env.UMAMI_USERNAME
  const password = process.env.UMAMI_PASSWORD

  if (!username || !password) {
    throw new Error('Missing UMAMI_API_TOKEN or UMAMI_USERNAME/UMAMI_PASSWORD in server environment.')
  }

  let loginData: { token?: string } | null = null

  for (let attempt = 0; attempt <= UPSTREAM_RETRIES; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)

    try {
      const loginResponse = await fetch(`${endpoint}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
        cache: 'no-store',
        signal: controller.signal,
      })

      if (!loginResponse.ok) {
        if (loginResponse.status >= 500 && attempt < UPSTREAM_RETRIES) {
          continue
        }

        throw new Error(`Umami login failed: ${loginResponse.status}`)
      }

      loginData = await loginResponse.json() as { token?: string }
      break
    } catch (error) {
      const isAbort = error instanceof DOMException && error.name === 'AbortError'
      const isLastAttempt = attempt === UPSTREAM_RETRIES

      if (!isAbort && isLastAttempt) {
        throw error
      }

      if (isAbort && isLastAttempt) {
        throw new Error('Umami login timed out.')
      }
    } finally {
      clearTimeout(timeout)
    }
  }

  if (!loginData) {
    throw new Error('Umami login failed after retries.')
  }

  if (!loginData.token) {
    throw new Error('Umami login succeeded but no token returned.')
  }

  tokenCache = {
    token: loginData.token,
    expiresAt: now + 10 * 60 * 1000,
  }

  return loginData.token
}

export async function fetchUmami<T>(
  endpoint: string,
  token: string,
  path: string,
  query: Record<string, string>,
): Promise<T> {
  const search = new URLSearchParams(query)

  for (let attempt = 0; attempt <= UPSTREAM_RETRIES; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)

    try {
      const response = await fetch(`${endpoint}/api${path}?${search.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
        signal: controller.signal,
      })

      if (!response.ok) {
        if (response.status >= 500 && attempt < UPSTREAM_RETRIES) {
          continue
        }

        throw new Error(`Umami API request failed (${response.status}) at ${path}`)
      }

      return response.json() as Promise<T>
    } catch (error) {
      const isAbort = error instanceof DOMException && error.name === 'AbortError'
      const isLastAttempt = attempt === UPSTREAM_RETRIES

      if (!isAbort && isLastAttempt) {
        throw error
      }

      if (isAbort && isLastAttempt) {
        throw new Error(`Umami API timeout at ${path}`)
      }
    } finally {
      clearTimeout(timeout)
    }
  }

  throw new Error(`Umami API request failed after retries at ${path}`)
}

export async function postUmami<T>(
  endpoint: string,
  token: string,
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  for (let attempt = 0; attempt <= UPSTREAM_RETRIES; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)

    try {
      const response = await fetch(`${endpoint}/api${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        cache: 'no-store',
        signal: controller.signal,
      })

      if (!response.ok) {
        if (response.status >= 500 && attempt < UPSTREAM_RETRIES) {
          continue
        }

        throw new Error(`Umami API POST failed (${response.status}) at ${path}`)
      }

      return response.json() as Promise<T>
    } catch (error) {
      const isAbort = error instanceof DOMException && error.name === 'AbortError'
      const isLastAttempt = attempt === UPSTREAM_RETRIES

      if (!isAbort && isLastAttempt) {
        throw error
      }

      if (isAbort && isLastAttempt) {
        throw new Error(`Umami API POST timeout at ${path}`)
      }
    } finally {
      clearTimeout(timeout)
    }
  }

  throw new Error(`Umami API POST failed after retries at ${path}`)
}