const CACHE_NAME = 'namaz-vakitleri-v1';
const ASSETS = [
  './',
  './namaz-vakitleri.html',
  'https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400&family=Outfit:wght@300;400;500;600&display=swap'
];

// Kurulum: tüm asset'leri cache'e al
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Font URL hata verirse diye teker teker dene
      return Promise.allSettled(ASSETS.map(url => cache.add(url)));
    }).then(() => self.skipWaiting())
  );
});

// Aktivasyon: eski cache'leri temizle
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: önce cache, sonra network (Cache First stratejisi)
self.addEventListener('fetch', e => {
  // Diyanet API isteklerini service worker'dan geçirme (CORS sorunu çıkarabilir)
  if (e.request.url.includes('ezanvakti.emushaf.net')) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        // Başarılı network yanıtını cache'e ekle
        if (response && response.status === 200 && response.type !== 'opaque') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => {
        // Network yok + cache yok → HTML döndür
        if (e.request.destination === 'document') {
          return caches.match('./namaz-vakitleri.html');
        }
      });
    })
  );
});
