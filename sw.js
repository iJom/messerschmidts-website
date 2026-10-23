/* The apps moved to app.messerschmidts.online. This replaces the apps' old offline
   worker on messerschmidts.online: it clears its caches, removes itself and reloads
   open tabs so they show the website. */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (event) {
  event.waitUntil((async function () {
    var keys = await caches.keys();
    await Promise.all(keys.map(function (k) { return caches.delete(k); }));
    await self.registration.unregister();
    var tabs = await self.clients.matchAll({ type: 'window' });
    tabs.forEach(function (c) { c.navigate(c.url); });
  })());
});
