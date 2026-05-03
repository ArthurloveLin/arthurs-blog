function trimTrailingSlash(value: string | undefined) {
  return value?.replace(/\/+$/, '') ?? ''
}

function normalizePath(path: string) {
  return path.startsWith('/') ? path : `/${path}`
}

function normalizeSearch(searchParams?: URLSearchParams | string) {
  if (!searchParams) {
    return ''
  }

  if (searchParams instanceof URLSearchParams) {
    const search = searchParams.toString()
    return search ? `?${search}` : ''
  }

  if (!searchParams) {
    return ''
  }

  return searchParams.startsWith('?') ? searchParams : `?${searchParams}`
}

export function getCommentWorkerUrl(path: string, searchParams?: URLSearchParams | string) {
  const baseUrl = trimTrailingSlash(process.env.NEXT_PUBLIC_ENGAGEMENT_WORKER_URL)
  if (!baseUrl) {
    return null
  }

  const url = new URL(baseUrl)
  const basePath = url.pathname === '/' ? '' : trimTrailingSlash(url.pathname)
  url.pathname = `${basePath}${normalizePath(path)}`
  url.search = normalizeSearch(searchParams)
  return url.toString()
}

export async function fetchCommentWorker(path: string, init?: RequestInit, searchParams?: URLSearchParams | string) {
  const workerUrl = getCommentWorkerUrl(path, searchParams)
  if (!workerUrl) {
    return null
  }

  return fetch(workerUrl, init)
}