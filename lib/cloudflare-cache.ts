export function buildCloudflarePurgeUrls(origin: string, paths: Iterable<string>) {
  const urls = new Set<string>()

  for (const path of paths) {
    urls.add(new URL(path, origin).toString())
  }

  return [...urls]
}

export async function purgeCloudflareFiles(
  origin: string,
  paths: Iterable<string>
): Promise<{ success: boolean; purged: number; errors?: string[] }> {
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
    return { success: false, purged: 0, errors: [`HTTP ${res.status}: ${text}`] }
  }

  const json = await res.json() as { success: boolean; errors?: { message: string }[] }
  if (!json.success) {
    const errors = (json.errors ?? []).map((e) => e.message)
    console.error('[CF purge] API error:', errors)
    return { success: false, purged: 0, errors }
  }

  return { success: true, purged: files.length }
}
