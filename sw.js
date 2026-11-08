// Network-first service worker: always fresh when online, still playable offline.
const CACHE = 'blockwild-v16';
const ASSETS = [
  './', 'index.html', 'css/style.css', 'manifest.webmanifest',
  'js/main.js', 'js/blocks.js', 'js/textures.js', 'js/noise.js', 'js/world.js',
  'js/renderer.js', 'js/player.js', 'js/input.js', 'js/mesher.js', 'js/models.js', 'js/animals.js', 'js/snakes.js', 'js/sky.js', 'js/net.js', 'js/raiders.js', 'js/crafting.js', 'js/goals.js', 'js/audio.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(a => new Request(a, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    // 'no-cache' revalidates with the server, so a new release shows up on the next load
    // (page navigations can't be re-wrapped with options, so they're rebuilt from the URL)
    fetch(req.mode === 'navigate' ? new Request(req.url, { cache: 'no-cache' }) : new Request(req, { cache: 'no-cache' })).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }))
  );
});
