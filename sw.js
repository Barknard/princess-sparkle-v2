// Service Worker for Princess Sparkle
// Strategy: Network-first with cache fallback
// On every launch, checks for new content and updates silently

const CACHE_NAME = 'princess-sparkle-v1';

// Files to pre-cache for offline play
const PRECACHE = [
  './',
  './index.html',
  './plugin.html',
  './plugin.js',
  './plugin.css',
  './PrincessSparkle.js',
  './cloudGenerator.js',
  './debugger.js',
  './manifest.json',
  './Princess Sparkle - Long.mp3',
  './audio/Magic_alarm_sound.wav',
  './audio/magic_twinkle.mp3',
  './audio/place_book.wav'
];

// Install: cache core files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first, fall back to cache
// This means she always gets the latest if online,
// but can still play offline with the cached version
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Got fresh response — update cache
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(() => {
        // Offline — serve from cache
        return caches.match(event.request);
      })
  );
});

// Listen for update check messages from the app
self.addEventListener('message', event => {
  if (event.data === 'CHECK_UPDATE') {
    self.registration.update();
  }
});
