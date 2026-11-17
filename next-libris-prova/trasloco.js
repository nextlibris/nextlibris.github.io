/* Trasloco di Next Libris da piero907.github.io a nextlibris.github.io (Piero, 17/11/2026).
   La stessa pagina (trasloco.html) fa due parti, secondo l'indirizzo in cui si apre:
   - al vecchio indirizzo MANDA: legge libri, impostazioni, account e foto di questa copia e li passa al nuovo;
   - al nuovo indirizzo RICEVE: li salva e apre l'app.
   Le due pagine si parlano con postMessage, solo tra i due indirizzi esatti, e una delle due deve aver aperto l'altra:
   se il nuovo si apre da solo, apre lui il vecchio. Se il browser non lo permette (app installata che apre una scheda
   a parte), c'e' il file del trasloco da scaricare al vecchio indirizzo e caricare al nuovo.
   Ogni copia passa solo i suoi dati: la prova (…/next-libris-prova/) solo quelli con il prefisso «prova:».
   Nel vecchio indirizzo i dati restano come riserva; si ricorda solo che il trasloco e' stato fatto. */
(function () {
'use strict';
var VECCHIO = 'https://piero907.github.io', NUOVO = 'https://nextlibris.github.io';
// prove automatiche (solo sul computer): i due indirizzi sono due porte diverse, passate nell'indirizzo della pagina
var Q = new URLSearchParams(location.search);
if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && Q.get('vecchio') && Q.get('nuovo')) { VECCHIO = Q.get('vecchio'); NUOVO = Q.get('nuovo'); }
var PROVE_Q = VECCHIO.indexOf('https://') ? '?vecchio=' + encodeURIComponent(VECCHIO) + '&nuovo=' + encodeURIComponent(NUOVO) : '';

var COPIA = (location.pathname.match(/\/next-libris-([a-z]+)(\/|$)/) || [])[1] || '';
var PREF = COPIA ? COPIA + ':' : '';
var BASE_V = VECCHIO + '/next-libris' + (COPIA ? '-' + COPIA : '') + '/';
var BASE_N = NUOVO + (COPIA ? '/next-libris-' + COPIA + '/' : '/');
var DBS = [(COPIA ? COPIA + '-' : '') + 'catalogo-libri', (COPIA ? COPIA + '-' : '') + 'catalogo-libri-social'];
var STORES = ['covers', 'copie'];
var K_FATTO = 'catalogo-libri-trasloco';
// non si passano: il segno del trasloco e l'iscrizione alle notifiche push, che vale solo per il vecchio indirizzo
var NON_PASSARE = [K_FATTO, 'catalogo-libri-push'];
var RUOLO = location.origin === NUOVO ? 'riceve' : location.origin === VECCHIO ? 'manda' : '';
// link d'invito e chiavi condivise (?amico=, #k=) passano al nuovo indirizzo; i parametri delle prove no
var DOPO = (function () { var q = new URLSearchParams(location.search); ['vecchio', 'nuovo', 'invia'].forEach(function (k) { q.delete(k); }); var s = q.toString(); return (s ? '?' + s : '') + location.hash; })();

var $ = function (s) { return document.querySelector(s); };
var partner = null, okPronto = false, finito = false, tAiuto = null;

/* ---------- aspetto come nell'app ---------- */
try {
  var s0 = JSON.parse(localStorage.getItem(PREF + 'catalogo-libri-set') || '{}');
  var th0 = s0.themeV2 ? s0.theme : (s0.theme === 'dark' ? 'dark' : 'light');
  if (th0 === 'light' || th0 === 'dark') document.documentElement.setAttribute('data-theme', th0);
  if (s0.palV2 && s0.pal) document.documentElement.setAttribute('data-pal', s0.pal);
} catch (e) {}

/* ---------- dati di questa copia sul telefono ---------- */
function chiaviMie() {
  var out = {};
  try {
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (!k || k.indexOf(PREF + 'catalogo-libri') !== 0) continue;
      var n = k.slice(PREF.length);
      if (NON_PASSARE.indexOf(n) < 0 && /^catalogo-libri[a-z0-9-]*$/.test(n)) out[n] = localStorage.getItem(k);
    }
  } catch (e) {}
  return out;
}
function contaLibri(ls) {
  try { var d = JSON.parse(ls['catalogo-libri-v2'] || '{}'); return (Array.isArray(d.books) ? d.books : []).filter(function (b) { return b && !b.deleted; }).length; } catch (e) { return 0; }
}
// apre un database del telefono solo se c'e' gia': se non c'e', non lo crea (l'app poi non saprebbe piu' crearlo giusto)
function apriSeC(nome) {
  return new Promise(function (res) {
    if (!window.indexedDB) { res(null); return; }
    var nuovo = false, r;
    try { r = indexedDB.open(nome); } catch (e) { res(null); return; }
    r.onupgradeneeded = function () { nuovo = true; try { r.transaction.abort(); } catch (e) {} };
    r.onsuccess = function () { if (nuovo) { r.result.close(); res(null); } else res(r.result); };
    r.onerror = function (e) { if (e && e.preventDefault) e.preventDefault(); res(null); };
    r.onblocked = function () { res(null); };
  });
}
function leggiStore(db, st) {
  return new Promise(function (res) {
    var out = [];
    try {
      var tx = db.transaction(st, 'readonly'), q = tx.objectStore(st).openCursor();
      q.onsuccess = function () { var c = q.result; if (c) { out.push([c.key, c.value]); c.continue(); } };
      tx.oncomplete = function () { res(out); };
      tx.onerror = tx.onabort = function () { res(out); };
    } catch (e) { res(out); }
  });
}
async function leggiTutto() {
  var ls = chiaviMie(), db = {}, foto = 0;
  for (var i = 0; i < DBS.length; i++) {
    var d = await apriSeC(DBS[i]);
    if (!d) continue;
    var o = {};
    for (var j = 0; j < STORES.length; j++) {
      if (!d.objectStoreNames.contains(STORES[j])) continue;
      o[STORES[j]] = await leggiStore(d, STORES[j]);
      if (STORES[j] === 'covers') foto += o[STORES[j]].length;
    }
    d.close();
    db[i] = o;   // per posizione: il nome del database cambia con la copia, ma la copia e' la stessa
  }
  return { t: 'dati', copia: COPIA, ls: ls, db: db, libri: contaLibri(ls), foto: foto };
}

/* ---------- salvataggio al nuovo indirizzo ---------- */
function valido(p) {
  if (!p || typeof p !== 'object' || p.copia !== COPIA || !p.ls || typeof p.ls !== 'object') return false;
  return Object.keys(p.ls).every(function (k) { return /^catalogo-libri[a-z0-9-]*$/.test(k) && NON_PASSARE.indexOf(k) < 0 && typeof p.ls[k] === 'string'; });
}
function apriPerScrivere(nome) {
  return new Promise(function (res, rej) {
    var r = indexedDB.open(nome, 1);   // stessa versione e stessi archivi che crea l'app
    r.onupgradeneeded = function () { STORES.forEach(function (s) { if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s); }); };
    r.onsuccess = function () { res(r.result); };
    r.onerror = function () { rej(r.error || new Error('db')); };
    r.onblocked = function () { rej(new Error('Chiudi Next Libris nelle altre schede e riprova.')); };
  });
}
async function scriviStore(db, st, righe) {
  if (!db.objectStoreNames.contains(st)) return;
  await new Promise(function (res, rej) {
    var tx = db.transaction(st, 'readwrite'), o = tx.objectStore(st);
    o.clear();
    righe.forEach(function (r) { if (Array.isArray(r) && (typeof r[0] === 'string' || typeof r[0] === 'number')) o.put(r[1], r[0]); });
    tx.oncomplete = res; tx.onerror = tx.onabort = function () { rej(tx.error || new Error('db')); };
  });
}
async function salva(p) {
  if (!valido(p)) throw new Error('Dati del trasloco non validi.');
  // prima le foto: se il telefono e' pieno, i libri di qui restano com'erano
  for (var i = 0; i < DBS.length; i++) {
    var o = p.db && p.db[i];
    if (!o || typeof o !== 'object') continue;
    var db = await apriPerScrivere(DBS[i]);
    try { for (var j = 0; j < STORES.length; j++) if (Array.isArray(o[STORES[j]])) await scriviStore(db, STORES[j], o[STORES[j]]); }
    finally { db.close(); }
  }
  var vecchie = Object.keys(chiaviMie());
  vecchie.forEach(function (k) { if (!(k in p.ls)) localStorage.removeItem(PREF + k); });
  Object.keys(p.ls).forEach(function (k) { localStorage.setItem(PREF + k, p.ls[k]); });
  localStorage.removeItem(PREF + 'catalogo-libri-push');   // le notifiche si riattivano qui
}

/* ---------- file del trasloco (quando le due pagine non si possono parlare) ---------- */
function blob2url(b) { return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(String(r.result)); }; r.onerror = rej; r.readAsDataURL(b); }); }
async function versoFile(p) {
  var db = {};
  for (var i in p.db) {
    db[i] = {};
    for (var st in p.db[i]) {
      db[i][st] = [];
      for (var j = 0; j < p.db[i][st].length; j++) {
        var r = p.db[i][st][j];
        db[i][st].push([r[0], r[1] instanceof Blob ? { __blob: await blob2url(r[1]) } : r[1]]);
      }
    }
  }
  return JSON.stringify({ app: 'next-libris-trasloco', v: 1, copia: p.copia, ls: p.ls, db: db, libri: p.libri, foto: p.foto });
}
async function daFile(testo) {
  var p = JSON.parse(testo);
  if (!p || p.app !== 'next-libris-trasloco') throw new Error('Questo non è un file del trasloco di Next Libris.');
  if (p.copia !== COPIA) throw new Error(p.copia ? 'Questo file è della copia di prova.' : 'Questo file è della versione vera, non della prova.');
  for (var i in p.db) for (var st in p.db[i]) {
    var righe = p.db[i][st];
    for (var j = 0; j < righe.length; j++) {
      var v = righe[j][1];
      if (v && typeof v.__blob === 'string' && /^data:image\//.test(v.__blob)) righe[j][1] = await (await fetch(v.__blob)).blob();
    }
  }
  return p;
}
function scarica(nome, testo) {
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([testo], { type: 'application/json' }));
  a.download = nome; document.body.appendChild(a); a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}

/* ---------- pagina ---------- */
function plur(n, uno, tanti) { return n === 1 ? '1 ' + uno : n + ' ' + tanti; }
function dataIt(t) { var d = new Date(t); return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }); }
function stato(t, cls) { var s = $('#trStato'); s.textContent = t || ''; s.className = 'tr-stato' + (cls ? ' ' + cls : ''); }
function mostra(o) {
  $('#trTit').textContent = o.tit;
  $('#trTxt').textContent = o.txt || '';
  var go = $('#trGo'), alt = $('#trAlt');
  go.hidden = !o.go; if (o.go) { go.textContent = o.go; go.onclick = o.fn; go.disabled = false; }
  alt.hidden = !o.alt; if (o.alt) { alt.textContent = o.alt; alt.onclick = o.altFn; }
  if (o.stato !== undefined) stato(o.stato, o.cls);
}
function apriApp() { location.replace(BASE_N + DOPO); }   // replace: l'Indietro dell'app non torna qui
function aiuto() {
  clearTimeout(tAiuto);
  tAiuto = setTimeout(function () { if (!finito) stato(RUOLO === 'manda' ? 'Non succede niente? Scarica il file del trasloco qui sotto e caricalo al nuovo indirizzo.' : 'Non succede niente? Al vecchio indirizzo scarica il file del trasloco e caricalo qui sotto.', 'warn'); }, 15000);
}
function manda(msg) { try { partner.postMessage(msg, NUOVO); } catch (e) {} }
function rispondi(msg) { try { partner.postMessage(msg, VECCHIO); } catch (e) {} }

/* --- vecchio indirizzo --- */
var mio = null;
async function avviaVecchio() {
  $('#trUrl').textContent = BASE_N.replace(/^https?:\/\//, '').replace(/\/$/, '');
  $('#trFileV').hidden = false;
  mio = await leggiTutto();
  var fatto = Number(localStorage.getItem(PREF + K_FATTO)) || 0;
  var vuota = !mio.libri && !mio.foto && !Object.keys(mio.ls).length;
  if (window.opener) { partner = window.opener; okPronto = true; mostra({ tit: 'Trasloco in corso', txt: 'Sto passando i tuoi libri al nuovo indirizzo…' }); manda({ t: 'ciao' }); aiuto(); return; }
  if (vuota && !fatto) { location.replace(BASE_N + DOPO); return; }
  if (fatto) mostra({ tit: 'Next Libris ha un nuovo indirizzo', txt: 'Hai già portato i tuoi libri il ' + dataIt(fatto) + '. Qui restano solo come riserva.', go: 'Apri Next Libris', fn: apriApp, alt: 'Rifai il trasloco', altFn: porta });
  else mostra({ tit: 'Next Libris ha un nuovo indirizzo', txt: 'Porta ' + (mio.libri ? plur(mio.libri, 'libro', 'libri') : 'le impostazioni') + (mio.foto ? ' e ' + plur(mio.foto, 'foto', 'foto') : '') + ' al nuovo indirizzo, con le impostazioni e l\'account. Qui restano come riserva.', go: 'Porta i miei libri', fn: porta });
}
function porta() {
  partner = window.open(BASE_N + 'trasloco.html' + PROVE_Q, '_blank');
  if (!partner) { stato('Il browser ha bloccato la nuova scheda: scarica il file del trasloco qui sotto.', 'warn'); return; }
  okPronto = true;
  $('#trGo').disabled = true;
  stato('Sto aprendo il nuovo indirizzo…'); aiuto();
}
async function scaricaFile() {
  stato('Preparo il file…');
  try { mio = await leggiTutto(); scarica('next-libris-trasloco' + (COPIA ? '-' + COPIA : '') + '.json', await versoFile(mio)); stato('File scaricato. Ora apri ' + BASE_N.replace(/^https?:\/\//, '') + 'trasloco.html e caricalo lì.'); }
  catch (e) { stato('Non riesco a preparare il file: ' + (e.message || e), 'bad'); }
}

/* --- nuovo indirizzo --- */
var qui = 0, confermato = false;
function avviaNuovo() {
  $('#trTit').textContent = 'Trasloco a Next Libris';
  $('#trUrl').textContent = 'da ' + VECCHIO.replace(/^https?:\/\//, '');
  $('#trFileN').hidden = false;
  qui = contaLibri(chiaviMie());
  confermato = !qui;
  if (window.opener) partner = window.opener;
  if (qui) mostra({ tit: 'Trasloco a Next Libris', txt: 'Qui ci sono già ' + plur(qui, 'libro', 'libri') + ': il trasloco li sostituisce con quelli del vecchio indirizzo.', go: 'Sostituisci', fn: conferma, alt: 'Annulla', altFn: apriApp });
  else if (partner) { mostra({ tit: 'Trasloco a Next Libris', txt: 'Sto ricevendo i tuoi libri…' }); rispondi({ t: 'pronto' }); aiuto(); }
  else mostra({ tit: 'Trasloco a Next Libris', txt: 'Prendi libri, foto, impostazioni e account dal vecchio indirizzo.', go: 'Prendi i miei libri', fn: prendi });
}
function conferma() {
  confermato = true;
  if (partner) { mostra({ tit: 'Trasloco a Next Libris', txt: 'Sto ricevendo i tuoi libri…' }); rispondi({ t: 'pronto' }); aiuto(); }
  else mostra({ tit: 'Trasloco a Next Libris', txt: 'Prendi libri, foto, impostazioni e account dal vecchio indirizzo.', go: 'Prendi i miei libri', fn: prendi });
}
function prendi() {
  partner = window.open(BASE_V + 'trasloco.html' + (PROVE_Q ? PROVE_Q + '&' : '?') + 'invia=1', '_blank');
  if (!partner) { stato('Il browser ha bloccato la nuova scheda: carica il file del trasloco qui sotto.', 'warn'); return; }
  $('#trGo').disabled = true;
  stato('Sto aprendo il vecchio indirizzo…'); aiuto();
}
async function ricevuto(p, daDove) {
  stato('Salvo i libri…');
  try {
    await salva(p);
    finito = true; clearTimeout(tAiuto); $('#trFileN').hidden = true;
    if (daDove) rispondi({ t: 'fatto', libri: p.libri | 0, foto: p.foto | 0 });
    mostra({ tit: 'Trasloco fatto', txt: 'Sono arrivati ' + plur(p.libri | 0, 'libro', 'libri') + (p.foto ? ' e ' + plur(p.foto | 0, 'foto', 'foto') : '') + '. Se avevi l\'app sul telefono, installala di nuovo da qui; anche le notifiche vanno riattivate.', go: 'Apri Next Libris', fn: apriApp, stato: '', cls: '' });
  } catch (e) {
    if (daDove) rispondi({ t: 'errore', msg: String(e.message || e) });
    stato('Il trasloco non è riuscito: ' + (e.message || e), 'bad');
  }
}
async function caricaFile(f) {
  if (!f) return;
  if (qui && !confermato && !confirm('Qui ci sono già ' + plur(qui, 'libro', 'libri') + ': il trasloco li sostituisce. Continuare?')) return;
  stato('Leggo il file…');
  try { await ricevuto(await daFile(await f.text()), false); }
  catch (e) { stato(e instanceof SyntaxError ? 'Questo non è un file del trasloco di Next Libris.' : String(e.message || e), 'bad'); }
}

/* --- messaggi tra le due pagine: solo dall'altro indirizzo e solo dalla scheda collegata --- */
window.addEventListener('message', function (e) {
  var d = e.data;
  if (!d || typeof d !== 'object' || !partner || e.source !== partner) return;
  if (RUOLO === 'manda' && e.origin === NUOVO) {
    if (d.t === 'pronto' && okPronto) {
      okPronto = false;
      stato('Sto passando i libri…');
      leggiTutto().then(function (p) { mio = p; manda(p); });
    } else if (d.t === 'fatto') {
      finito = true; clearTimeout(tAiuto); $('#trFileV').hidden = true;
      try { localStorage.setItem(PREF + K_FATTO, String(Date.now())); } catch (er) {}
      var aperta = !!window.opener;
      mostra({ tit: 'Trasloco fatto', txt: 'I tuoi libri sono al nuovo indirizzo' + (aperta ? ': puoi chiudere questa scheda.' : '. Qui restano come riserva.'), go: aperta ? '' : 'Apri Next Libris', fn: apriApp, stato: '', cls: '' });
      if (aperta) setTimeout(function () { try { window.close(); } catch (er) {} }, 1500);
    } else if (d.t === 'errore') {
      okPronto = true; $('#trGo').disabled = false;
      stato('Il nuovo indirizzo non ha potuto salvare: ' + String(d.msg || '').slice(0, 200), 'bad');
    }
  } else if (RUOLO === 'riceve' && e.origin === VECCHIO) {
    if (d.t === 'ciao' && confermato && !finito) { rispondi({ t: 'pronto' }); stato('Sto ricevendo i libri…'); }
    else if (d.t === 'dati' && confermato && !finito) ricevuto(d, true);
  }
});

$('#trScarica').onclick = scaricaFile;
$('#trFile').onchange = function () { caricaFile(this.files && this.files[0]); this.value = ''; };
if (RUOLO === 'manda') avviaVecchio();
else if (RUOLO === 'riceve') avviaNuovo();
else mostra({ tit: 'Trasloco di Next Libris', txt: 'Questa pagina funziona solo su ' + VECCHIO.replace('https://', '') + ' e ' + NUOVO.replace('https://', '') + '.' });
})();
