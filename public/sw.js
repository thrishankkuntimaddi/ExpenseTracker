// ─── Service Worker — Expense Tracker PWA ────────────────────────
// Bump this version whenever you deploy to bust old caches.
const CACHE_NAME = 'et-v6';
const BASE = '/ExpenseTracker/';

// Install: skip waiting immediately so the new SW activates ASAP
self.addEventListener('install', () => {
  self.skipWaiting();
});

// Activate: delete ALL old caches, then claim clients
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch strategy ──────────────────────────────────────────────
//
//  HTML navigation  →  NETWORK-FIRST (always get latest deploy)
//                      fallback to cache only when fully offline
//
//  JS / CSS assets  →  CACHE-FIRST (they are content-hashed, safe)
//
//  Firebase / CDN   →  pass through, never intercept
//
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
    return; // let browser handle it
  }

  // ── HTML navigation: NETWORK-FIRST ──
  // This ensures every page load gets the latest deployed index.html.
  // Users will never be stuck on a stale page after a deploy.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          // Cache the fresh HTML for offline fallback
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          return response;
        })
        .catch(() =>
          // Offline: serve cached HTML if available
          caches.match(e.request).then((cached) => cached || caches.match(BASE + 'index.html'))
        )
    );
    return;
  }

  // ── Static assets (JS/CSS/images): CACHE-FIRST ──
  // Safe because Vite content-hashes all asset filenames.
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        return response;
      });
    })
  );
});
