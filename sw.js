// sw.js — versiyonu elle değiştirmeye gerek yok.
// namaz-vakitleri.html SW kaydederken ?v=YYYYMMDDHHMI parametresi geçirir.
// Her deploy'da HTML değiştiği için tarayıcı yeni SW'yi otomatik algılar.

const SW_URL     = new URL(location.href);
const VERSION    = SW_URL.searchParams.get('v') || 'v1';
const CACHE_NAME = `namaz-${VERSION}`;

const ASSETS = [
  './',
  './namaz-vakitleri.html',
  './zikir.html',
  'https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400&family=Outfit:wght@300;400;500;600&display=swap'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.allSettled(ASSETS.map(url => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    if (self.registration.navigationPreload) {
      await self.registration.navigationPreload.enable();
    }
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  if (e.request.url.includes('ezanvakti.emushaf.net')) return;

  if (e.request.mode === 'navigate') {
    e.respondWith((async () => {
      const cached = await caches.match(e.request);
      if (cached) return cached;
      try {
        const preloadResponse = await e.preloadResponse;
        if (preloadResponse) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(e.request, preloadResponse.clone());
          return preloadResponse;
        }
      } catch(err) {}
      try {
        const response = await fetch(e.request);
        if (response && response.status === 200) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(e.request, response.clone());
        }
        return response;
      } catch(err) {
        return caches.match('./namaz-vakitleri.html');
      }
    })());
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (response && response.status === 200 && response.type !== 'opaque') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => {
        if (e.request.destination === 'document') {
          return caches.match('./namaz-vakitleri.html');
        }
      });
    })
  );
});
