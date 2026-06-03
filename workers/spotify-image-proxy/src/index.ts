const ALLOWED_HOSTNAMES = ['.scdn.co', '.spotifycdn.com'];

function isAllowedHostname(hostname: string): boolean {
	return ALLOWED_HOSTNAMES.some((suffix) => hostname === suffix.slice(1) || hostname.endsWith(suffix));
}

export default {
	async fetch(request: Request, _env: Env, ctx: ExecutionContext): Promise<Response> {
		if (request.method === 'OPTIONS') {
			return new Response(null, {
				status: 204,
				headers: {
					'Access-Control-Allow-Origin': '*',
					'Access-Control-Allow-Methods': 'GET',
					'Access-Control-Max-Age': '86400',
				},
			});
		}

		if (request.method !== 'GET' && request.method !== 'HEAD') {
			return new Response('Method Not Allowed', { status: 405 });
		}

		const url = new URL(request.url);

		if (url.pathname === '/health') {
			return new Response(
				JSON.stringify({ status: 'ok', service: 'spotify-image-proxy', timestamp: new Date().toISOString(), components: {} }),
				{ status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } },
			);
		}

		if (url.pathname !== '/spotify') {
			return new Response('Not Found', { status: 404 });
		}

		const spotifyUrlParam = url.searchParams.get('url');
		if (!spotifyUrlParam) {
			return new Response('Missing required parameter: url', { status: 400 });
		}

		let spotifyUrl: URL;
		try {
			spotifyUrl = new URL(spotifyUrlParam);
		} catch {
			return new Response('Invalid url parameter', { status: 400 });
		}

		if (spotifyUrl.protocol !== 'https:' || !isAllowedHostname(spotifyUrl.hostname)) {
			return new Response('URL not allowed — only *.scdn.co and *.spotifycdn.com are permitted', { status: 403 });
		}

		// Normalize cache key: strip query params Spotify might add
		const cacheKey = new Request(`https://spotify-img-proxy/${spotifyUrl.pathname}`, { method: 'GET' });
		const cache = caches.default;

		const cached = await cache.match(cacheKey);
		if (cached) {
			const hit = new Response(cached.body, cached);
			hit.headers.set('X-Cache', 'HIT');
			return hit;
		}

		let upstream: Response;
		try {
			upstream = await fetch(spotifyUrl.toString(), {
				headers: { Accept: 'image/*' },
				// Tell CF not to cache the subrequest separately
				cf: { cacheEverything: false },
			});
		} catch (err) {
			console.error({ msg: 'upstream fetch failed', url: spotifyUrl.toString(), err: String(err) });
			return new Response('Failed to fetch upstream image', { status: 502 });
		}

		if (!upstream.ok) {
			return new Response(`Upstream returned ${upstream.status}`, { status: upstream.status });
		}

		const headers = new Headers();
		const ct = upstream.headers.get('Content-Type');
		if (ct) headers.set('Content-Type', ct);
		headers.set('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
		headers.set('Access-Control-Allow-Origin', '*');
		headers.set('X-Cache', 'MISS');

		// Stream body directly — never buffer (128 MB Worker memory limit)
		const response = new Response(upstream.body, { status: 200, headers });

		ctx.waitUntil(cache.put(cacheKey, response.clone()));

		return response;
	},
} satisfies ExportedHandler<Env>;
