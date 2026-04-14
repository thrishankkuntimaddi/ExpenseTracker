// ─── Service Worker — Expense Tracker PWA ────────────────────────
// IMPORTANT: Bump CACHE_NAME on every deploy to bust stale caches.
const CACHE_NAME = 'et-v8';
const BASE = '/ExpenseTracker/';

// ── Install: skip waiting immediately so new SW takes over right away ──
self.addEventListener('install', (e) => {
  // Pre-cache only the HTML shell. JS/CSS have content hashes and get
  // cached on first fetch. Skipping large asset pre-cache avoids install
  // failures on slow mobile connections.
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.add(BASE + 'index.html'))
      .then(() => self.skipWaiting())   // activate ASAP, don't wait for old tabs
      .catch((err) => {
        // Don't let a cache-add failure block SW install
        console.warn('[SW] Install pre-cache failed (non-fatal):', err);
        return self.skipWaiting();
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

// ── Message: allow app to force SW update/reload ──
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── Fetch strategy ──────────────────────────────────────────────
//  HTML navigation  →  NETWORK-FIRST (always get latest deploy)
//                      fallback to cache only when fully offline
//  JS / CSS assets  →  CACHE-FIRST  (content-hashed; safe)
//  Firebase / CDN   →  PASSTHROUGH  (never intercepted)
// ────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (e) => {
  const url = e.request.url;

  // ── Never intercept Firebase / Google API / external requests ──
  const isExternal = (
    url.includes('firestore.googleapis.com') ||
    url.includes('identitytoolkit.googleapis.com') ||
    url.includes('securetoken.googleapis.com') ||
    url.includes('firebase') ||
    url.includes('gstatic.com') ||
    url.includes('googleapis.com') ||
    url.includes('fonts.googleapis.com') ||
    url.includes('fonts.gstatic.com')
  );
  if (isExternal) return; // let browser handle natively

  // ── HTML navigation: NETWORK-FIRST ──
  // Always try to pull the freshest index.html; only fallback to cache when offline.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
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
  const isHashedAsset = /\/assets\/[^/]+-[A-Za-z0-9]{8}\.(js|css)/.test(url);

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
