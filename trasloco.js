/* Vecchio indirizzo di Next Libris (piero907.github.io/next-libris/): solo «Ci siamo spostati» (Piero, 18/11/2026).
   Il trasloco dei dati (17/11/2026, con messaggi tra le pagine e file) e' finito: tutti gli utenti sono passati al nuovo indirizzo,
   quindi qui non si legge e non si manda piu' niente. La pagina porta al nuovo indirizzo con i link d'invito e le
   chiavi condivise (?amico=, #k=). Aperta al nuovo indirizzo, apre l'app. */
(function () {
'use strict';
var NUOVO = 'https://nextlibris.app';   // dalla 120 (21/11/2026); prima nextlibris.github.io
// prove automatiche (solo sul computer): il nuovo indirizzo e' una porta diversa, passata nell'indirizzo della pagina
var Q = new URLSearchParams(location.search);
if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && Q.get('nuovo')) NUOVO = Q.get('nuovo');
var COPIA = (location.pathname.match(/\/next-libris-([a-z]+)(\/|$)/) || [])[1] || '';
var BASE_N = location.origin === NUOVO ? './' : NUOVO + (COPIA ? '/next-libris-' + COPIA + '/' : '/');
['vecchio', 'nuovo', 'invia'].forEach(function (k) { Q.delete(k); });
var s = Q.toString(), DOVE = BASE_N + (s ? '?' + s : '') + location.hash;
var a = document.getElementById('trGo'); if (a) a.href = DOVE;
location.replace(DOVE);   // replace: l'Indietro non torna qui
})();
