/* notes-site/sw.js — offline cache. build.mjs fills the placeholders and writes it to the site root. */
const VERSION = '66b7dffac3';
const BASE = '/notes';
const CACHE = 'notes-' + VERSION;
const PRECACHE = ["/notes/","/notes/bayes-and-particle-filters/l1-joint-marginal-and-conditional/","/notes/bayes-and-particle-filters/l2-bayes-theorem/","/notes/bayes-and-particle-filters/l3-hidden-state-models/","/notes/bayes-and-particle-filters/l4-the-bayes-filter/","/notes/bayes-and-particle-filters/l5-monte-carlo-and-particles/","/notes/bayes-and-particle-filters/l6-importance-sampling/","/notes/bayes-and-particle-filters/l7-resampling-and-sir/","/notes/bayes-and-particle-filters/","/notes/lqr-riccati-and-the-bellman-bridge/","/notes/lee-2020-prerequisites-lecture-notes/","/notes/silver-rl/lecture-10-lecture-notes/","/notes/silver-rl/lecture-2-lecture-notes/","/notes/silver-rl/lecture-2-question-list/","/notes/silver-rl/lecture-3-lecture-notes/","/notes/silver-rl/lecture-3-question-list/","/notes/silver-rl/lecture-4-lecture-notes/","/notes/silver-rl/lecture-4-question-list/","/notes/silver-rl/lecture-5-lecture-notes/","/notes/silver-rl/lecture-5-question-list/","/notes/silver-rl/lecture-6-lecture-notes/","/notes/silver-rl/lecture-6-reading-companion/","/notes/silver-rl/lecture-7-lecture-notes/","/notes/silver-rl/lecture-8-lecture-notes/","/notes/silver-rl/lecture-9-lecture-notes/","/notes/assets/site.css?v=66b7dffac3","/notes/assets/site.js?v=66b7dffac3","/notes/assets/katex/katex.min.css","/notes/search-index.json","/notes/offline.html"];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.allSettled(PRECACHE.map((u) => c.add(u)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('notes-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || !url.pathname.startsWith(BASE + '/')) return;
  const isPage = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  if (isPage) {
    // Pages: network first, so a merged PR shows up on the next load; cached copy when offline.
    e.respondWith(fetch(req).then((res) => { if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone())); return res; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match(BASE + '/offline.html'))));
    return;
  }
  // Assets: cache first, refresh in the background.
  e.respondWith(caches.match(req).then((cached) => {
    const net = fetch(req).then((res) => { if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone())); return res; }).catch(() => cached);
    return cached || net;
  }));
});
