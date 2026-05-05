export function buildCloudflarePurgeUrls(origin: string, paths: Iterable<string>) {
  const urls = new Set<string>()

  for (const path of paths) {
    urls.add(new URL(path, origin).toString())
  }

  return [...urls]
}

export async function purgeCloudflareFiles(origin: string, paths: Iterable<string>) {
  if (!process.env.CF_ZONE_ID || !process.env.CF_API_TOKEN) {
    return
  }

  const files = buildCloudflarePurgeUrls(origin, paths)
  if (files.length === 0) {
    return
  }

  await fetch(`https://api.cloudflare.com/client/v4/zones/${process.env.CF_ZONE_ID}/purge_cache`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.CF_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ files }),
  })
}