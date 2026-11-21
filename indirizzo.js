/* Indirizzi vecchi di Next Libris. Gira prima di tutto il resto.
   1) piero907.github.io/next-libris/ (fino al 17/11/2026): l'app non parte piu', si apre solo la pagina del trasloco
      (trasloco.html, «Ci siamo spostati»), che porta al nuovo indirizzo. La copia di prova (…/next-libris-prova/) resta dov'e'.
      Gli altri script si fermano scrivendo un <plaintext> nascosto: il resto della pagina diventa testo e non parte.
      (Versione 100: window.stop() annullava anche il passaggio a trasloco.html e la pagina restava vuota; corretto nella 101.)
   2) nextlibris.github.io (17-21/11/2026): dalla 120 Next Libris sta su https://nextlibris.app/ (Piero, 21/11/2026: solo rimando,
      niente trasloco dei dati: con l'account i libri tornano dalla copia online). GitHub rimanda da solo le pagine al nuovo
      indirizzo; questo serve all'app gia' installata, che parte dalla copia sul telefono senza passare dalla rete.
      Quando nextlibris.app risponde, si va li' (con ?amico= e #k=); prima del passaggio non succede niente. */
(function () {
  var stop = function () { try { document.write('<plaintext hidden style="display:none">'); } catch (e) {} };
  if (location.hostname === 'nextlibris.github.io') {
    var NUOVO = 'https://nextlibris.app';
    var vai = function () { location.replace(NUOVO + location.pathname.replace(/[^/]*$/, '') + location.search + location.hash); };
    try {
      if (sessionStorage.getItem('nl-nuovo-ok') === '1') { vai(); stop(); return; }   // gia' visto acceso: subito, senza aspettare
    } catch (e) {}
    try {
      fetch(NUOVO + '/version.json?c=' + Date.now(), { cache: 'no-store' }).then(function (r) {
        if (!r.ok) return;
        try { sessionStorage.setItem('nl-nuovo-ok', '1'); } catch (e) {}
        vai();
      }, function () {});
    } catch (e) {}
    return;
  }
  if (location.hostname !== 'piero907.github.io') return;
  // trasloco.html non carica questo file: se gira qui, un service worker vecchio (100) ha dato index.html al posto
  // della pagina del trasloco. Al vecchio indirizzo il service worker non serve piu': lo tolgo e ricarico dalla rete.
  if (/^\/next-libris\/trasloco\.html$/.test(location.pathname)) {
    var giro = 0; try { giro = Number(sessionStorage.getItem('nl-trasloco-sw')) || 0; sessionStorage.setItem('nl-trasloco-sw', String(giro + 1)); } catch (e) {}
    if (giro < 2 && navigator.serviceWorker) {
      stop();
      navigator.serviceWorker.getRegistrations().then(function (rr) { return Promise.all(rr.filter(function (r) { return /\/next-libris\/$/.test(r.scope); }).map(function (r) { return r.unregister(); })); })
        .catch(function () {}).then(function () { location.reload(); });
    }
    return;
  }
  if (!/^\/next-libris\/(index\.html)?$/.test(location.pathname)) return;
  location.replace('trasloco.html' + location.search + location.hash);
  stop();
})();
