// ─── Service Worker — Expense Tracker PWA ────────────────────────
const CACHE_NAME = 'et-v5';
const BASE = '/ExpenseTracker/';

const APP_SHELL = [
  BASE,
  BASE + 'index.html',
];

// Install: cache app shell
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: cache-first for shell, network-first for everything else
// Firebase SDK handles Firestore offline natively via IndexedDB
self.addEventListener('fetch', (e) => {
  const url = e.request.url;

  // Let Firebase / CDN requests pass through
  if (
    url.includes('firestore.googleapis.com') ||
    url.includes('identitytoolkit.googleapis.com') ||
    url.includes('securetoken.googleapis.com') ||
    url.includes('firebase') ||
    url.includes('gstatic.com') ||
    url.includes('googleapis.com')
  ) {
    return;
  }

  // Cache-first for same-origin navigation + static assets
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        return response;
      }).catch(() => caches.match(BASE + 'index.html'));
    })
  );
});
