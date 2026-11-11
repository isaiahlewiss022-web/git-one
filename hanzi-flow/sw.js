/*
 * Hanzi Flow — service worker
 * Makes the app installable and usable offline when it is served over https (for example
 * GitHub Pages). It caches the app shell and the word data on first visit; stroke files are
 * cached the first time they are needed.
 *
 * Bump VERSION whenever data/ or vendor/ files change, so installed phones fetch them again.
 */
const VERSION = 'hanzi-flow-2026-11-11b';
const SHELL = [
  './',
  'index.html',
  'styles.css',
  'manifest.webmanifest',
  'js/01-data.js',
  'js/02-helpers.js',
  'js/03-state.js',
  'js/04-audio.js',
  'js/05-srs.js',
  'js/06-ui.js',
  'js/07-home-flow.js',
  'js/07b-typing.js',
  'js/08-play.js',
  'js/08b-sentences.js',
  'js/09-words-me.js',
  'js/10-main.js',
  'data/vocab.js',
  'data/chars.js',
  'data/sentences.js',
  'data/glosses.js',
  'vendor/hanzi-writer.min.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      // 'reload' skips the browser's HTTP cache, so a new version never stores a stale copy
      .then((cache) => cache.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Same-origin GET requests only. Google Fonts and other hosts go straight to the network.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // The page itself: network first, so a new release shows up on the next open; cache offline.
  if (req.mode === 'navigate' || url.pathname.endsWith('/index.html')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('index.html'))),
    );
    return;
  }

  // App code and styles: serve from cache at once, refresh the cache in the background.
  if (/\.(css|webmanifest)$/.test(url.pathname) || /\/js\//.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const refresh = fetch(req)
          .then((res) => {
            if (res.ok) caches.open(VERSION).then((c) => c.put(req, res.clone()));
            return res;
          })
          .catch(() => cached);
        return cached || refresh;
      }),
    );
    return;
  }

  // Data, strokes, vendor code and icons: cache first, fetch and store on a miss.
  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req).then((res) => {
          if (res.ok) caches.open(VERSION).then((c) => c.put(req, res.clone()));
          return res;
        }),
    ),
  );
});
