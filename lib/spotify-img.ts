const PROXY = 'https://img.arthurlovegrace.top/spotify';

export function spotifyImg(url: string | null | undefined): string | null {
  if (!url) return null;
  return `${PROXY}?url=${encodeURIComponent(url)}`;
}
