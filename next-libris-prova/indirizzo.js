/* Next Libris si sposta su https://nextlibris.github.io/ (Piero, 17/11/2026). Al vecchio indirizzo
   (piero907.github.io/next-libris/) l'app non parte piu': si apre solo la pagina del trasloco (trasloco.html),
   che porta libri, foto e impostazioni al nuovo. La copia di prova (…/next-libris-prova/) resta dov'e'.
   Gira prima di tutto il resto; window.stop() ferma gli altri script, cosi' la vecchia app non sincronizza piu'.
   ATTIVO diventa true solo il giorno del passaggio, insieme alla pubblicazione su nextlibris.github.io. */
(function () {
  var ATTIVO = false;
  if (!ATTIVO || location.hostname !== 'piero907.github.io' || !/^\/next-libris\/(index\.html)?$/.test(location.pathname)) return;
  location.replace('trasloco.html' + location.search + location.hash);
  try { window.stop(); } catch (e) {}
})();
