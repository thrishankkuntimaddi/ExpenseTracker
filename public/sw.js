// ─── Service Worker — Expense Tracker PWA ────────────────────────
// IMPORTANT: Bump CACHE_NAME on every deploy to bust stale caches.
const CACHE_NAME = 'et-v7';
const BASE = '/ExpenseTracker/';

// ── Install: skip waiting so new SW activates immediately ──
self.addEventListener('install', (e) => {
  // Pre-cache only index.html so we always have an offline shell
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.add(BASE + 'index.html'))
      .then(() => self.skipWaiting())
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

  // ── Never intercept Firebase / Google API requests ──
  if (
    url.includes('firestore.googleapis.com') ||
    url.includes('identitytoolkit.googleapis.com') ||
    url.includes('securetoken.googleapis.com') ||
    url.includes('firebase') ||
    url.includes('gstatic.com') ||
    url.includes('googleapis.com') ||
    url.includes('fonts.googleapis.com') ||
    url.includes('fonts.gstatic.com')
  ) {
    return; // let browser handle it natively
  }

  // ── HTML navigation: NETWORK-FIRST ──
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
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
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((response) => {
        // Only cache valid same-origin responses
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        return response;
      }).catch(() => {
        // If asset is missing, try serving the cached shell as last resort
        return caches.match(BASE + 'index.html');
      });
    })
  );
});
