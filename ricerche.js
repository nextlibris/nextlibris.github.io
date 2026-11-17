/* Next Libris · modulo «Ricerche condivise» (16/11/2026, nella copia di prova). Scelte di Piero del 16/11/2026.
   1) Contatore condiviso: chi usa la stessa chiave Google (o lo stesso worker SBN) ha un solo conto del giorno, su Supabase
      (conta_ricerche, per sha256 della chiave: la chiave non esce dal telefono). Le soglie dell'app valgono sul totale:
      700 niente copertine grandi, suggerimenti e novità; 950 i dati arrivano solo da Open Library e SBN. Worker: 95.000.
   2) A 950 il database manda a chi la sta usando una notifica «limite» (campanella); aprendola si vede la guida
      «Crea la tua chiave Google Libri: è gratis», con i passaggi e i link.
   3) Archivio comune per ISBN: prima di Google si guarda se qualcuno ha già cercato quel libro (da_archivio);
      dopo una ricerca riuscita i dati pubblici (titolo, autore, editore, anno, pagine, copertina, descrizione) vanno nell'archivio.
   Serve l'account: senza, l'app fa come prima (contatore solo sul telefono, niente archivio).
   Database: supabase/012_ricerche_archivio.sql (ramo prove). Usa window.NL, window.NLSocial, window.NLNotifiche. */
(function () {
'use strict';
var NL = window.NL, S = window.NLSocial; if (!NL || !S || !S.call || !NL.setShared) return;
var esc = NL.esc, K_LENT = 'catalogo-libri-amici-chiave-in-uso';
var hashes = {}, pend = { g: 0, s: 0 }, timer = null, busy = false;
var KEEP = ['t', 'a', 'e', 'y', 'pg', 'img', 'imgL', 'ds', 'dsl', 'gen', 'se', 'sn'];
var LINKS = { project: 'https://console.cloud.google.com/projectcreate', api: 'https://console.cloud.google.com/apis/library/books.googleapis.com',
  cred: 'https://console.cloud.google.com/apis/credentials' };

function uid() { var a = S.auth(); return a && a.uid; }
function rpc(name, body) { return S.call('/rest/v1/rpc/' + name, { method: 'POST', user: true, body: body || {} }); }
async function hash(v) {
  if (hashes[v]) return hashes[v];
  var d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v));
  return (hashes[v] = Array.prototype.map.call(new Uint8Array(d), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''));
}
function lender(key) { try { var b = JSON.parse(NL.ls.get(K_LENT) || 'null'); return b && b.gb && b.gb === key ? String(b.nome || '') : ''; } catch (e) { return ''; } }

/* ---------- contatore condiviso ---------- */
NL.on('apiCall', function (k) {
  if (!uid() || (k !== 'g' && k !== 's')) return;
  var sv = NL.svc(); if (!(k === 'g' ? sv.gbKey : sv.sbnUrl)) return;
  pend[k]++;
  schedule(pend.g + pend.s >= 10 ? 0 : 3000);                       // a gruppi: una richiesta a Supabase ogni ~10 ricerche o 3 secondi
});
function schedule(ms) { clearTimeout(timer); timer = setTimeout(function () { flush(false); }, ms); }
async function flush(read) {
  if (busy) { schedule(1500); return; }
  if (!uid()) { pend = { g: 0, s: 0 }; return; }
  busy = true;
  var sv = NL.svc(), q = NL.quota(), crossed = false;
  for (var i = 0; i < 2; i++) {
    var k = i ? 's' : 'g', val = k === 'g' ? sv.gbKey : sv.sbnUrl;
    if (!val) { pend[k] = 0; continue; }
    var n = Math.min(pend[k], 200); if (!n && !read) continue;
    pend[k] -= n;
    try {
      var tot = Number(await rpc('conta_ricerche', { chiave: k + ':' + await hash(val), n: n, di: k === 'g' ? lender(val) : '' })) || 0;
      NL.setShared(k, tot, k === 'g' ? q.d : q.ds);
      if (k === 'g' && tot >= 950 && tot - n < 950) crossed = true;
    } catch (e) { pend[k] += n; }                                      // senza rete: si conta dopo
  }
  busy = false;
  if (crossed && window.NLNotifiche) window.NLNotifiche.load();      // la notifica «limite» è appena arrivata
  if (pend.g || pend.s) schedule(5000);
}
/* il totale di oggi si rilegge insieme agli amici (apertura, ritorno all'app, ogni ~3 minuti) */
if (window.NLAmici && window.NLAmici.onLoad) window.NLAmici.onLoad(function () { flush(true); });
S.onAuth(function () { if (uid()) setTimeout(function () { flush(true); }, 2000); });
if (uid()) setTimeout(function () { flush(true); }, 2500);
document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden' && (pend.g || pend.s)) flush(false); });

/* ---------- archivio comune per ISBN ---------- */
function within(p, ms) { return Promise.race([p, new Promise(function (ok) { setTimeout(function () { ok(null); }, ms); })]); }
NL.archive = {
  get: async function (isbn) {
    if (!uid() || !/^97[89]\d{10}$/.test(isbn || '') || navigator.onLine === false) return null;
    var d = null;
    try { d = await within(rpc('da_archivio', { isbn: isbn }), 2500); } catch (e) { return null; }
    if (!d || typeof d !== 'object' || !d.t || !d.a || !(d.e || d.y)) return null;   // incompleto: si cerca come sempre (e si completa l'archivio)
    var r = { i: isbn, src: 'Archivio comune' };
    KEEP.forEach(function (k) { if (d[k]) r[k] = String(d[k]); });
    if (r.imgL && NL.L.badBigCover && NL.L.badBigCover(r.imgL)) delete r.imgL;   // zoom=0 di Google: non e' la copertina (17/11/2026)
    return r;
  },
  put: function (isbn, r) {
    if (!uid() || !r || !r.t || !/^97[89]\d{10}$/.test(isbn || '')) return;
    var o = {}; KEEP.forEach(function (k) { if (r[k] != null && r[k] !== '') o[k] = String(r[k]); });
    if (o.imgL && NL.L.badBigCover && NL.L.badBigCover(o.imgL)) delete o.imgL;
    rpc('archivia', { isbn: isbn, dati: o }).catch(function () {});
  }
};
NL.on('bigCover', function (x) { if (x && x.t && x.imgL) NL.archive.put(x.i, { t: x.t, imgL: x.imgL }); });   // la copertina grande trovata dopo

/* ---------- guida: crea la tua chiave Google Libri (dalla notifica «limite») ---------- */
function sheet() {
  var el = document.getElementById('kgSheet'); if (el) return el;
  el = document.createElement('div'); el.className = 'sheet kg'; el.id = 'kgSheet'; el.hidden = true;
  el.innerHTML = '<div class="sheet-in" role="dialog" aria-modal="true" aria-labelledby="kgH"><h2 id="kgH">Crea la tua chiave Google Libri</h2>' +
    '<p class="msg" id="kgWhy"></p>' +
    '<div class="kg-free"><b>È gratis</b><span>Non si paga niente. Google ti dà <b>1.000 ricerche al giorno, solo per te</b>. Ci vogliono circa 5 minuti, una volta sola.</span></div>' +
    '<ol class="kg-steps">' +
      '<li>Apri <a href="' + LINKS.project + '" target="_blank" rel="noopener">Google Cloud</a> ed entra con il tuo account Google. Crea un progetto con il nome che vuoi (per esempio «Libri»).</li>' +
      '<li>Apri <a href="' + LINKS.api + '" target="_blank" rel="noopener">Books API</a> e tocca «Abilita».</li>' +
      '<li>Vai in <a href="' + LINKS.cred + '" target="_blank" rel="noopener">Credenziali</a> › «Crea credenziali» › «Chiave API».</li>' +
      '<li>Copia la chiave (comincia con <b>AIza</b>) e incollala qui: Menu › Impostazioni › Ricerca dei libri.</li>' +
    '</ol>' +
    '<div class="row-btns"><button class="btn" type="button" id="kgClose">Più tardi</button><a class="btn primary" id="kgGo" href="' + LINKS.project + '" target="_blank" rel="noopener">Apri Google Cloud</a></div>' +
    '<button class="link" type="button" id="kgPaste">Ho già la chiave: incollala</button></div>';
  document.body.appendChild(el);
  var shut = function () { el.hidden = true; };
  el.addEventListener('click', function (e) { if (e.target === el) shut(); });
  el.querySelector('#kgClose').addEventListener('click', shut);
  el.querySelector('#kgPaste').addEventListener('click', function () { shut(); NL.openOptions('search'); setTimeout(function () { var i = document.getElementById('gbKey'); if (i) i.focus(); }, 300); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !el.hidden) shut(); });
  return el;
}
function guide(who) {
  var el = sheet();
  document.getElementById('kgWhy').innerHTML = who === true
    ? 'Con una chiave tua la ricerca trova più libri, con copertina grande, descrizione e suggerimenti, e non dipendi dalla chiave di un amico.'
    : who
    ? 'La chiave di <b>' + esc(who) + '</b> ha finito le ricerche di oggi. Intanto i libri si cercano con Open Library e il catalogo delle biblioteche (SBN); con una chiave tua hai di nuovo tutte le ricerche, anche le copertine grandi e i suggerimenti.'
    : 'La tua chiave ha finito le ricerche di oggi: torna domattina verso le 9. La usano anche gli amici a cui l\'hai prestata: mandagli questi passaggi, così ne creano una loro.';
  el.hidden = false;
}
window.NLRicerche = { guide: guide, flush: flush, state: function () { return { pend: pend }; } };
})();
