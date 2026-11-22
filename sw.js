/* Vecchio indirizzo (nextlibris.github.io), dal 22/11/2026: niente app, solo «Ci siamo trasferiti» (Piero).
   Questo service worker prende il posto di quello vecchio sui telefoni dove l'app era installata da qui:
   cancella la copia salvata dell'app, si toglie da solo e ricarica le pagine aperte, che arrivano dalla rete
   (index.html = la pagina del trasloco, che porta a https://nextlibris.app). */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    try { const ks = await caches.keys(); await Promise.all(ks.map((k) => caches.delete(k))); } catch (err) {}
    try { await self.registration.unregister(); } catch (err) {}
    try { const cs = await self.clients.matchAll({ type: 'window' }); cs.forEach((c) => { try { c.navigate(c.url); } catch (err) {} }); } catch (err) {}
  })());
});
