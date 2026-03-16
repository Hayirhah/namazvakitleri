const CACHE_NAME = 'namaz-vakitleri-v2';
const ASSETS = [
  './',
  './namaz-vakitleri.html',
  'https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400&family=Outfit:wght@300;400;500;600&display=swap'
];

// Kurulum: tüm asset'leri cache'e al
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(ASSETS.map(url => cache.add(url)));
    }).then(() => self.skipWaiting())
  );
});

// Aktivasyon: eski cache'leri temizle + navigation preload etkinleştir
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    // ③ Navigation Preload: ağ isteği ve cache aramasını paralel yapar
    // Tekrar ziyarette HTML anında cache'den gelirken ağ da hazırlanmış olur
    if (self.registration.navigationPreload) {
      await self.registration.navigationPreload.enable();
    }

    // Eski cache sürümlerini temizle
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    );

    await self.clients.claim();
  })());
});

// Fetch: önce cache, sonra network (Cache First stratejisi)
self.addEventListener('fetch', e => {
  // Diyanet API isteklerini service worker'dan geçirme (CORS sorunu çıkarabilir)
  if (e.request.url.includes('ezanvakti.emushaf.net')) return;

  // Navigation isteği (sayfa yüklemesi) → preload yanıtını kullan
  if (e.request.mode === 'navigate') {
    e.respondWith((async () => {
      // Önce cache'e bak
      const cached = await caches.match(e.request);
      if (cached) return cached;

      // Cache yok → preload yanıtını (veya normal fetch'i) kullan
      try {
        const preloadResponse = await e.preloadResponse;
        if (preloadResponse) {
          // Preload yanıtını cache'e de ekle
          const cache = await caches.open(CACHE_NAME);
          cache.put(e.request, preloadResponse.clone());
          return preloadResponse;
        }
      } catch(err) {}

      // Son çare: normal fetch
      try {
        const response = await fetch(e.request);
        if (response && response.status === 200) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(e.request, response.clone());
        }
        return response;
      } catch(err) {
        // Tamamen offline → cache'den fallback
        return caches.match('./namaz-vakitleri.html');
      }
    })());
    return;
  }

  // Diğer istekler (CSS, JS, görseller): Cache First
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
