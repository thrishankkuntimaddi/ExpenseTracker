// The web app used to live at this address with an offline service worker.
// It has moved (see index.html); this replaces that worker once, clears its
// caches and steps aside, so this address shows the product page. It never
// reloads an open page.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('et-')).map((k) => caches.delete(k)));
    await self.registration.unregister();
  })());
});
