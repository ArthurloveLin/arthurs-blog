import type { Env } from './env'

export async function getR2Object(env: Env, key: string): Promise<string> {
  const object = await env.SPOTIFY_BUCKET.get(key)

  if (!object) {
    throw new Error(`NoSuchKey: ${key}`)
  }

  return object.text()
}