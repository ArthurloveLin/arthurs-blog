export type Env = Cloudflare.Env & {
  SPOTIFY_CLIENT_ID: string
  SPOTIFY_CLIENT_SECRET: string
  SPOTIFY_REFRESH_TOKEN: string
  LASTFM_API_KEY?: string
  SPOTIFY_SYNC_SECRET?: string
}
