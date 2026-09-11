const CACHE_NAME = 'sukidesu-v6';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './admin.html',
  './manifest-admin.json',
  './css/output.css',
  './js/api.js',
  './images/screen.png',
  './icon-192x192.png',
  './icon-512x512.png'
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

self.addEventListener('fetch', (event) => {
  // Ignora peticiones que no sean GET y cualquier llamada a dominios o servicios de Google
  if (event.request.method !== 'GET' || event.request.url.includes('google')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      
      const networkFetch = fetch(event.request).then((networkResponse) => {
        // Almacena en caché la respuesta válida, permitiendo guardar por primera vez las imágenes de Cloudflare
        if (networkResponse && networkResponse.status === 200) {
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse.clone()));
        }
        return networkResponse;
      }).catch(() => {
        // Mantiene la resiliencia si no hay conexión
      });

      // Retorna instantáneamente la versión de caché si existe, de lo contrario espera la respuesta de red
      return cachedResponse || networkFetch;
    })
  );
});