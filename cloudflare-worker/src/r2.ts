import { Env } from './env'

export async function getR2Object(env: Env, key: string): Promise<string> {
  const object = await env.SPOTIFY_BUCKET.get(key)
  if (!object) {
    throw new Error(`NoSuchKey: ${key}`)
  }
  return object.text()
}

export async function putR2Object(env: Env, key: string, value: string, contentType: string = 'application/json; charset=utf-8'): Promise<void> {
  await env.SPOTIFY_BUCKET.put(key, value, {
    httpMetadata: {
      contentType,
      cacheControl: 'no-store'
    }
  })
}

export async function listR2Objects(env: Env, prefix: string): Promise<string[]> {
  const keys: string[] = []
  let cursor: string | undefined

  do {
    const listed = await env.SPOTIFY_BUCKET.list({
      prefix,
      cursor,
    })
    
    keys.push(...listed.objects.map(obj => obj.key))
    
    if (listed.truncated) {
      cursor = listed.cursor
    } else {
      cursor = undefined
    }
  } while (cursor)

  return keys
}
