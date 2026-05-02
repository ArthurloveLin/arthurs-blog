function trimTrailingSlash(value: string | undefined) {
  return value?.replace(/\/+$/, '') ?? ''
}

function normalizePath(path: string) {
  return path.startsWith('/') ? path : `/${path}`
}

const engagementWorkerBase = trimTrailingSlash(process.env.NEXT_PUBLIC_ENGAGEMENT_WORKER_URL)

export function getEngagementPublicApiUrl(path: string) {
  const normalizedPath = normalizePath(path)

  if (!engagementWorkerBase) {
    return normalizedPath
  }

  const url = new URL(engagementWorkerBase)
  const basePath = url.pathname === '/' ? '' : url.pathname.replace(/\/+$/, '')
  url.pathname = `${basePath}${normalizedPath}`

  return url.toString()
}