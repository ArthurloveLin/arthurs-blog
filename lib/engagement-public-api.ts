function resolveEngagementUrl(path: string): string {
  const workerBase = process.env.NEXT_PUBLIC_ENGAGEMENT_WORKER_URL?.replace(/\/+$/, '')
  if (!workerBase) return path

  try {
    const base = new URL(workerBase)
    const basePath = base.pathname === '/' ? '' : base.pathname.replace(/\/+$/, '')
    const [pathname, search] = path.split('?')
    base.pathname = `${basePath}${pathname}`
    if (search) base.search = `?${search}`
    return base.toString()
  } catch {
    return path
  }
}

export function fetchEngagementPublicApi(path: string, init?: RequestInit): Promise<Response> {
  return fetch(resolveEngagementUrl(path), init)
}
