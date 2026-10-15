// ─── Service Worker — Expense Tracker PWA ────────────────────────
// The build ID is stamped in by vite.config.js at build time, so every
// deploy gets a fresh cache name automatically (no manual bumping).
const CACHE_NAME = 'et-__BUILD_ID__';
const BASE = '/ExpenseTracker/';
// Every hashed JS/CSS file of this build, stamped in at build time. Screens
// load on demand, so pre-caching them all is what makes a screen you never
// opened online still work offline.
const ASSETS = __ASSETS__; /* global __ASSETS__ */

// ── Install: pre-cache, then WAIT. A new version takes over when every tab
//    / app window of the old one is closed — never by reloading a page you're
//    using. (Pages load index.html network-first, so a fresh open already
//    runs the newest code; this only refreshes the offline copy.)
self.addEventListener('install', (e) => {
  // Pre-cache the HTML shell plus this build's assets. A failure is
  // non-fatal: anything missed is cached on first fetch instead.
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll([BASE + 'index.html', ...ASSETS.map((a) => BASE + a)]))
      .catch((err) => {
        // Don't let a cache-add failure block SW install
        console.warn('[SW] Install pre-cache failed (non-fatal):', err);
      })
  );
});

// ── Activate: wipe ALL old caches, then claim all clients ──
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME)
            .map((k) => {
              console.log('[SW] Deleting old cache:', k);
              return caches.delete(k);
            })
        )
      )
      .then(() => {
        console.log('[SW] Activated cache:', CACHE_NAME);
        // Claim all clients immediately so the new SW serves pages right away
        return self.clients.claim();
      })
  );
});

// (No "skip waiting" message: pages can't force a takeover mid-use.)

// ── Fetch strategy ──────────────────────────────────────────────
//  HTML navigation  →  NETWORK-FIRST (always get latest deploy)
//                      fallback to cache only when fully offline
//  JS / CSS assets  →  CACHE-FIRST  (content-hashed; safe)
//  Cross-origin     →  PASSTHROUGH  (Firebase, Google APIs, fonts)
// ────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (e) => {
  const url = e.request.url;

  // ── Only handle this site's own GET requests. Firebase, Google APIs and
  //    fonts are cross-origin and go straight to the network. (Matching on
  //    the URL text instead would also catch our own firebase-*.js chunk.)
  if (e.request.method !== 'GET' || new URL(url).origin !== self.location.origin) return;
  // App updates and installers (/app/…) go straight to the network — never cached here
  if (new URL(url).pathname.startsWith(BASE + 'app/')) return;

  // ── HTML navigation: NETWORK-FIRST ──
  // Always try to pull the freshest index.html; fall back to the cache when
  // offline or when the network hangs (weak signal) for more than 4 s.
  if (e.request.mode === 'navigate') {
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000));
    e.respondWith(
      Promise.race([fetch(e.request, { cache: 'no-store' }), timeout])
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          }
          return response;
        })
        .catch(() =>
          // Offline fallback: prefer exact URL match, then root shell
          caches.match(e.request)
            .then((cached) => cached || caches.match(BASE + 'index.html'))
        )
    );
    return;
  }

  // ── Static assets (JS/CSS/images): CACHE-FIRST ──
  // Content-hashed files (e.g. index-AbCd1234.js) are immutable — safe to cache forever.
  // Non-hashed files (manifest.json, sw.js, icons) use network-first to stay fresh.
  const isHashedAsset = /\/assets\/[^/]+-[\w-]{8}\.(js|css)$/.test(new URL(url).pathname);

  if (isHashedAsset) {
    // Cache-first: hashed file → cache hit = instant; miss = fetch + cache
    e.respondWith(
      caches.match(e.request).then((cached) => {
        if (cached) return cached;
        return fetch(e.request).then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          }
          return response;
        }).catch(() => {
          // Asset totally unavailable — serve cached shell as last resort
          return caches.match(BASE + 'index.html');
        });
      })
    );
  } else {
    // Non-hashed assets (icons, manifest): network-first with cache fallback
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(e.request))
    );
  }
});

// ── Cloud push (Firebase Cloud Messaging, data messages) ──
// Reminders while the page is closed, and security alerts. The payload is
// { data: { title, body, route, tag } } (FCM may also wrap it as notification).
self.addEventListener('push', (e) => {
  let p = {};
  try { p = e.data ? e.data.json() : {}; } catch { p = { data: { title: 'Expense Tracker', body: e.data?.text() } }; }
  const d = { ...(p.notification || {}), ...(p.data || {}) };
  if (!d.title) return;
  e.waitUntil(self.registration.showNotification(d.title, {
    body: d.body || '', icon: BASE + 'icon-192.png', badge: BASE + 'icon-192.png',
    tag: d.tag || 'et-push', renotify: d.type === 'security', data: { route: d.route || 'today' },
  }));
});

// ── Reminder taps: focus (or open) the app and tell it which screen to show ──
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const route = e.notification.data?.route;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const client = list.find((c) => c.url.startsWith(self.registration.scope));
      if (client) {
        client.postMessage({ type: 'reminder-tap', route });
        return client.focus();
      }
      return self.clients.openWindow(self.registration.scope);
    })
  );
});
