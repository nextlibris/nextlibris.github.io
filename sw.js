/* Next Libris: funziona anche senza rete. Le ricerche (Google Libri, Open Library) passano sempre dalla rete. */
// le copie parallele (…/next-libris-prova/, in generale …/next-libris-NOME/) stanno allo stesso indirizzo di base: copie offline con un prefisso
// loro, e ognuna cancella solo le proprie (la versione vera non tocca quelle che cominciano con «nome-catalogo-libri-»)
const COPIA = (self.registration.scope.match(/\/next-libris-([a-z]+)\//) || [])[1] || '';
const CACHE = (COPIA ? COPIA + '-' : '') + 'catalogo-libri-v112';
const MINE = (k) => (COPIA ? k.startsWith(COPIA + '-') : !/^[a-z]+-catalogo-libri-/.test(k));
const SHELL = ['./', 'index.html', 'indirizzo.js', 'avvio.js', 'style.css', 'app.js', 'app-aggiungi.js', 'app-vista.js', 'app-scheda.js', 'app-per-te.js', 'app-elenco.js', 'app-finestre.js', 'app-filtri.js', 'app-strumenti.js', 'app-wiki.js', 'app-avvio.js',   // app.js divisa in parti (17/11/2026)
  'lib.js', 'manifest.json', 'stile-c.css', 'stile-g.css', 'stile-g.js',   // stile «C · Schede» (restyle 19/11/2026)
  'icons/next-libris-192.png', 'icons/next-libris-512.png', 'vendor/zxing.min.js', 'vendor/fonts/literata-latin.woff2', 'vendor/fonts/bricolage-latin.woff2', 'vendor/fonts/plex-latin-400.woff2', 'vendor/fonts/plex-latin-500.woff2', 'vendor/fonts/plex-latin-600.woff2', 'vendor/tesseract.min.js', 'vendor/worker.min.js', 'REGISTRO_MODIFICHE.md',
  'wrap.js', 'wrap.css',   // modulo: riepilogo ogni tre mesi
  'layout.js', 'layout.css',   // modulo: disposizione dello schermo
  'schede.js', 'schede.css',   // modulo: aspetto della scheda aperta
  'social.js', 'social.css',   // modulo: account e sincronizzazione
  'profilo.js', 'profilo.css',   // modulo: profilo
  'amici.js', 'amici.css',   // modulo: amici
  'notifiche.js', 'notifiche.css',   // modulo: notifiche (campanella)
  'chat.js', 'chat.css',   // modulo: chat (giro 9b)
  'ricerche.js', 'ricerche.css',   // modulo: ricerche condivise e archivio comune
  'push.js', 'push.css',   // modulo: notifiche push
  'guida.js', 'guida.css',   // modulo: guida di primo avvio e libreria di esempio
  'trasloco.html', 'trasloco.js', 'privacy.html'];   // trasloco.html: senza, la pagina arriverebbe come index.html; privacy.html: letta anche dalla finestra Privacy (17/11/2026)

self.addEventListener('install', (e) => {
  // un file mancante non deve impedire al service worker di partire (addAll fallirebbe per intero)
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE && MINE(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim()));   // anche la «prossima» di un service worker vecchio
});
/* Avvio immediato: la pagina e i suoi file partono dalla copia sul telefono (stessa versione, niente attese di rete);
   intanto, in sottofondo, scarico la versione nuova di tutti i file e la salvo solo se arrivano tutti (mai versioni mescolate).
   Le richieste «ricarica» (Aggiorna adesso) vanno sempre in rete. */
const SHELL_PATHS = new Set(SHELL.map((u) => new URL(u, self.registration.scope).pathname));
let lastRefresh = 0;
const NEXT = CACHE + '-prossima';
async function promoteNext(cache) {
  try {
    const next = await caches.open(NEXT);
    if (!(await next.match('__pronta'))) return;
    const keys = (await next.keys()).filter((k) => !k.url.endsWith('/__pronta'));
    await Promise.all(keys.map(async (k) => cache.put(k, await next.match(k))));
    await caches.delete(NEXT);
  } catch (e) {}
}
async function refreshShell() {
  if (Date.now() - lastRefresh < 60000) return;
  lastRefresh = Date.now();
  try {
    const got = await Promise.all(SHELL.map((u) => fetch(u, { cache: 'no-cache' }).then((r) => (r.ok && r.status === 200 ? r : null), () => null)));
    if (got.some((r) => !r)) return;                       // rete assente o un file mancante: tengo la versione che ho
    // la preparo a parte: prende il posto della copia in uso solo alla prossima apertura (la pagina aperta resta coerente)
    await caches.delete(NEXT);
    const next = await caches.open(NEXT);
    await Promise.all(got.map((r, i) => next.put(SHELL[i], r)));
    await next.put('__pronta', new Response('1'));
  } catch (e) {}
}
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.endsWith('/version.json')) return;            // il controllo della versione va sempre in rete, senza copie
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const fresh = req.mode !== 'navigate' && (req.cache === 'reload' || req.cache === 'no-cache' || req.cache === 'no-store');   // l'apertura della pagina parte sempre dalla copia
    if (fresh) await caches.delete(NEXT);                    // «Aggiorna adesso»: vale la rete, non una copia preparata prima
    if (!fresh) {
      const nav = req.mode === 'navigate';
      if (nav) await promoteNext(cache);
      const hit = (await cache.match(req, { ignoreSearch: nav })) || (nav ? await cache.match('index.html') : null);
      if (hit) {
        if (nav) e.waitUntil(refreshShell());
        return hit;
      }
    }
    try {
      const res = await fetch(req);
      if (res.ok && res.status === 200 && (fresh || SHELL_PATHS.has(url.pathname) || url.pathname.includes('/vendor/') || url.pathname.includes('/icons/'))) cache.put(req, res.clone());
      if (!res.ok && req.mode === 'navigate') { const idx = await cache.match('index.html'); if (idx) return idx; }
      return res;
    } catch (err) {
      const hit = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
      if (hit) return hit;
      if (req.mode === 'navigate') { const idx = await cache.match('index.html'); if (idx) return idx; }
      throw err;
    }
  })());
});

/* Notifiche push (modulo push.js, funzione «push» su Supabase): stesso testo della campanella; numero sull'icona dove si
   può (iPhone, computer; su Android il pallino lo mette il telefono). Con l'app in primo piano si aggiorna solo la campanella
   (su iPhone la notifica va mostrata sempre, altrimenti il telefono toglie l'iscrizione). */
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil((async () => {
    const cl = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    cl.forEach((c) => { try { c.postMessage({ nl: 'push' }); } catch (x) {} });
    if (self.navigator.setAppBadge && d.n) { try { await self.navigator.setAppBadge(d.n); } catch (x) {} }
    const apple = /iPhone|iPad|Macintosh/.test(self.navigator.userAgent);
    if (!apple && cl.some((c) => c.visibilityState === 'visible' && c.focused)) return;
    await self.registration.showNotification(d.title || 'Next Libris', {
      body: d.body || 'Hai una novità in Next Libris', tag: d.tag || 'nl', icon: 'icons/next-libris-192.png', lang: 'it', data: { nt: 1 }
    });
  })());
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const cl = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const mine = cl.find((c) => c.url.startsWith(self.registration.scope));
    if (mine) { try { await mine.focus(); } catch (x) {} mine.postMessage({ nl: 'apri-notifiche' }); return; }
    await self.clients.openWindow(new URL('./?nt=1', self.registration.scope).href);
  })());
});
