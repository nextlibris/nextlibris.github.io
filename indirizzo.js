/* Next Libris si sposta su https://nextlibris.github.io/ (Piero, 17/11/2026). Al vecchio indirizzo
   (piero907.github.io/next-libris/) l'app non parte piu': si apre solo la pagina del trasloco (trasloco.html),
   che porta libri, foto e impostazioni al nuovo. La copia di prova (…/next-libris-prova/) resta dov'e'.
   Gira prima di tutto il resto. Gli altri script si fermano scrivendo un <plaintext> nascosto: il resto della pagina
   diventa testo e non parte, cosi' la vecchia app non sincronizza piu'. (Versione 100: window.stop() annullava anche
   il passaggio a trasloco.html e la pagina restava vuota; corretto nella 101.)
   ATTIVO diventa true solo il giorno del passaggio, insieme alla pubblicazione su nextlibris.github.io. */
(function () {
  var ATTIVO = true;   // acceso con la versione 100 (passaggio a nextlibris.github.io)
  if (!ATTIVO || location.hostname !== 'piero907.github.io') return;
  var stop = function () { try { document.write('<plaintext hidden style="display:none">'); } catch (e) {} };
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
