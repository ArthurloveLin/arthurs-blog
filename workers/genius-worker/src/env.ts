export type Env = Cloudflare.Env & {
  GENIUS_API_TOKEN: string
  GENIUS_WORKER_SECRET?: string
}
