// Offline support. Every file of the game is cached on install, so it runs
// without a network after the first visit. The deploy workflow stamps
// VERSION with the commit, so each release installs a fresh cache and the
// old one is dropped; the new version takes over on the next launch.
const VERSION = 'dev';
const CACHE = `dopa-agri-${VERSION}`;

const ASSETS = [
  './',
  'index.html',
  'style.css',
  'manifest.webmanifest',
  'icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'fonts/dela-gothic-one.woff2',
  'fonts/zen-maru-gothic-black.woff2',
  'fonts/zen-maru-gothic-bold.woff2',
  'js/audio.js',
  'js/bg.js',
  'js/core.js',
  'js/dopakichi.js',
  'js/fx.js',
  'js/growth.js',
  'js/guide.js',
  'js/main.js',
  'js/problems.js',
  'js/quests.js',
  'js/quizbank.js',
  'js/scoring.js',
  'js/session.js',
  'js/skills.js',
  'js/store.js',
  'js/trophies.js',
  'js/unlocks.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('dopa-agri-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // Pages open with query strings (?skill=, ?seed=); they all share index.html.
  const key = req.mode === 'navigate' ? 'index.html' : req;
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(key, { ignoreSearch: req.mode === 'navigate' });
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok && res.type === 'basic') c.put(req, res.clone());
    return res;
  }));
});
