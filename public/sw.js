const CACHE = 'stakeo-v1'
const SHARE_CACHE = 'stakeo-share'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (url.origin !== location.origin) return

  if (e.request.method === 'POST' && url.pathname === '/share-target') {
    e.respondWith(
      (async () => {
        try {
          const form = await e.request.formData()
          const file = form.get('image')
          if (file) {
            const cache = await caches.open(SHARE_CACHE)
            await cache.put('/shared-image', new Response(file, { headers: { 'Content-Type': file.type || 'image/png' } }))
          }
        } catch {
          /* ignore malformed share */
        }
        return Response.redirect('/?shared=1', 303)
      })()
    )
    return
  }

  if (e.request.method !== 'GET') return
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      try {
        const fresh = await fetch(e.request)
        if (fresh.ok) cache.put(e.request, fresh.clone())
        return fresh
      } catch {
        const cached = await cache.match(e.request)
        return cached || (await cache.match('/')) || Response.error()
      }
    })
  )
})
