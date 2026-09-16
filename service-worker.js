const CACHE_NAME = 'linuxaid-v3';
const APP_SHELL = [
  './',
  './index.html',
  './dashboard.html',
  './linux.html',
  './courses.html',
  './labs.html',
  './tools.html',
  './profile.html',
  './auth.html',
  './offline.html',
  './styles.css',
  './product.css',
  './app.js',
  './config.js',
  './gemini.js',
  './firebase.js',
  './favicon.svg',
  './manifest.webmanifest',
  './js/siteEnhancements.js',
  './js/terminalEngine.js',
  './js/commandCatalog.js',
  './js/security.js',
  './js/progress.js',
  './js/learningData.js',
  './js/learningPages.js',
  './js/linuxTools.js',
  './js/toolsPage.js',
  './js/profilePage.js',
  './js/authPage.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.allSettled(APP_SHELL.map(url => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Never cache API or Firebase traffic.
  if (url.pathname.includes('/api/') || url.hostname.includes('googleapis.com') || url.hostname.includes('firebase')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          return response;
        })
        .catch(async () => (await caches.match(request)) || caches.match('./offline.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      const network = fetch(request).then(response => {
        if (response.ok && url.origin === self.location.origin) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
