const CACHE_NAME = 'sukidesu-v7';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './css/output.css',
  './js/api.js',
  './images/screen.png',
  './images/icon-192x192.png',
  './images/icon-512x512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

event.respondWith(
  caches.match(event.request).then((cachedResponse) => {
    
    const networkFetch = fetch(event.request).then((networkResponse) => {
      // Almacena en caché la respuesta válida, permitiendo guardar por primera vez las imágenes de Cloudflare
      if (networkResponse && networkResponse.status === 200) {
        
        // Clonación síncrona INMEDIATA para evitar que el navegador la consuma primero
        const responseToCache = networkResponse.clone();
        
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
      }
      return networkResponse;
    }).catch(() => {
      // Mantiene la resiliencia si no hay conexión
    });

    // Retorna instantáneamente la versión de caché si existe, de lo contrario espera la respuesta de red
    return cachedResponse || networkFetch;
  })
);
