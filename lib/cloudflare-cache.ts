export function buildCloudflarePurgeUrls(origin: string, paths: Iterable<string>) {
  const urls = new Set<string>()

  for (const path of paths) {
    // Cloudflare always caches the HTTPS version (end-user URL). Force https:
    // even if Next.js received an http:// request from CF's flexible-SSL proxy.
    const url = new URL(path, origin)
    url.protocol = 'https:'
    urls.add(url.toString())
  }

  return [...urls]
}

export async function purgeCloudflareFiles(
  origin: string,
  paths: Iterable<string>
): Promise<{ success: boolean; purged: number; urls?: string[]; errors?: string[] }> {
  if (!process.env.CF_ZONE_ID || !process.env.CF_API_TOKEN) {
    return { success: true, purged: 0 }
  }

  const files = buildCloudflarePurgeUrls(origin, paths)
  if (files.length === 0) {
    return { success: true, purged: 0 }
  }

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${process.env.CF_ZONE_ID}/purge_cache`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.CF_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ files }),
    }
  )

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    console.error(`[CF purge] HTTP ${res.status}: ${text}`)
    return { success: false, purged: 0, urls: files, errors: [`HTTP ${res.status}: ${text}`] }
  }

  const json = await res.json() as { success: boolean; errors?: { message: string }[] }
  if (!json.success) {
    const errors = (json.errors ?? []).map((e) => e.message)
    console.error('[CF purge] API error:', errors)
    return { success: false, purged: 0, urls: files, errors }
  }

  return { success: true, purged: files.length, urls: files }
}

/**
 * Purges the entire Cloudflare zone cache (equivalent to "Purge Everything" in the CF dashboard).
 * Use when per-URL purge is insufficient, e.g. after a full blog reindex.
 */
export async function purgeCloudflareZone(): Promise<{ success: boolean; errors?: string[] }> {
  if (!process.env.CF_ZONE_ID || !process.env.CF_API_TOKEN) {
    return { success: true }
  }

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${process.env.CF_ZONE_ID}/purge_cache`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.CF_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ purge_everything: true }),
    }
  )

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    console.error(`[CF purge everything] HTTP ${res.status}: ${text}`)
    return { success: false, errors: [`HTTP ${res.status}: ${text}`] }
  }

  const json = await res.json() as { success: boolean; errors?: { message: string }[] }
  if (!json.success) {
    const errors = (json.errors ?? []).map((e) => e.message)
    console.error('[CF purge everything] API error:', errors)
    return { success: false, errors }
  }

  return { success: true }
}
