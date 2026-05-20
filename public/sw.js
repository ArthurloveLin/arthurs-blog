const CACHE_VERSION = 'v1'
const STATIC_CACHE = `static-${CACHE_VERSION}`
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`

const STATIC_RE = /\/_next\/static\//
const FONT_RE = /\/fonts\//

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(DYNAMIC_CACHE)
      .then(cache => cache.addAll(['/memo', '/offline']))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => !k.endsWith(CACHE_VERSION)).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  if (request.method !== 'GET') return
  if (url.origin !== self.location.origin) return

  // /_next/static/ 和字体：immutable，直接 cache-first
  if (STATIC_RE.test(url.pathname) || FONT_RE.test(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  // memo API：network-first，离线时返回缓存数据
  if (url.pathname.startsWith('/api/note-boards/memo')) {
    event.respondWith(networkFirst(request, DYNAMIC_CACHE, jsonFallback))
    return
  }

  // 页面导航：network-first，离线时返回缓存页面或 /offline
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNav(request))
    return
  }
})

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) {
    const cache = await caches.open(cacheName)
    cache.put(request, response.clone())
  }
  return response
}

async function networkFirst(request, cacheName, offlineFallback) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    return (await caches.match(request)) ?? offlineFallback()
  }
}

async function networkFirstNav(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    return (
      (await caches.match(request)) ??
      (await caches.match('/offline')) ??
      new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/html' } })
    )
  }
}

function jsonFallback() {
  return new Response(JSON.stringify({ error: 'offline', messages: [] }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  })
}
