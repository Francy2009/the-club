const CACHE_NAME = 'the-club-static-v2'
const STATIC_ASSETS = ['/manifest.json', '/logo192.png', '/logo512.png', '/favicon.ico']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  const url = new URL(event.request.url)

  if (url.origin !== self.location.origin) return

  const isStaticAsset =
    STATIC_ASSETS.includes(url.pathname) ||
    url.pathname.startsWith('/assets/') ||
    /\.(?:css|js|png|jpg|jpeg|webp|svg|ico|woff2?)$/.test(url.pathname)

  if (!isStaticAsset) {
    event.respondWith(fetch(event.request))
    return
  }

  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)))
})
